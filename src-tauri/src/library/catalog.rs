use std::collections::{HashMap, HashSet};
use std::path::Path;

use rusqlite::{params, Connection};
use serde::Serialize;

use super::scanner::FolderScan;
use super::title::{parse_title, year_of};

#[derive(Debug, Default, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ScanSummary {
    pub added: usize,
    pub updated: usize,
    pub missing: usize,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MovieDto {
    pub id: i64,
    pub path: String,
    pub title: String,
    pub year: Option<i32>,
    pub size_bytes: i64,
    pub modified_at: i64,
    pub added_at: i64,
    pub duration_seconds: Option<i64>,
    pub progress_seconds: Option<i64>,
    pub last_played_at: Option<i64>,
}

struct KnownFile {
    size_bytes: i64,
    modified_at: i64,
    missing: bool,
}

/// Brings the catalog in line with a fresh folder scan:
/// - new files are inserted;
/// - files whose size changed are treated as a different file: they get a fresh title and year,
///   and their duration and playback progress are cleared because they described the old file;
/// - files whose modification time alone changed (a copy or a touch) keep their metadata and
///   progress; only the stored time is refreshed, silently;
/// - re-found files are un-marked as missing;
/// - catalog entries not found are marked missing, except under paths the scan could not read.
///   Rows are never deleted, so progress survives a temporarily unavailable file.
///
/// `missing` in the summary only counts movies inside the scanned folder. Rows left over from a
/// previous library folder are marked missing too, but are not reported as lost files.
///
/// Run it inside a transaction so a failure leaves the catalog untouched.
pub fn apply_scan(conn: &Connection, scan: &FolderScan, now: i64) -> rusqlite::Result<ScanSummary> {
    let max_year = year_of(now) + 1;
    let mut summary = ScanSummary::default();

    let known: HashMap<String, KnownFile> = {
        let mut stmt = conn.prepare("SELECT path, size_bytes, modified_at, missing FROM movies")?;
        let rows = stmt.query_map([], |row| {
            Ok((
                row.get::<_, String>(0)?,
                KnownFile { size_bytes: row.get(1)?, modified_at: row.get(2)?, missing: row.get(3)? },
            ))
        })?;
        rows.collect::<rusqlite::Result<_>>()?
    };

    let mut insert = conn.prepare_cached(
        "INSERT INTO movies (path, title, year, size_bytes, modified_at, added_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
    )?;
    let mut replace = conn.prepare_cached(
        "UPDATE movies
         SET title = ?2, year = ?3, size_bytes = ?4, modified_at = ?5, missing = 0,
             duration_seconds = NULL, progress_seconds = NULL
         WHERE path = ?1",
    )?;
    let mut refresh = conn.prepare_cached("UPDATE movies SET modified_at = ?2, missing = 0 WHERE path = ?1")?;
    let mut mark_missing = conn.prepare_cached("UPDATE movies SET missing = 1 WHERE path = ?1")?;

    for file in &scan.files {
        let stem = Path::new(&file.path).file_stem().and_then(|s| s.to_str()).unwrap_or(&file.path);
        match known.get(&file.path) {
            None => {
                let (title, year) = parse_title(stem, max_year);
                insert.execute(params![file.path, title, year, file.size_bytes, file.modified_at, now])?;
                summary.added += 1;
            }
            Some(existing) if existing.size_bytes != file.size_bytes => {
                let (title, year) = parse_title(stem, max_year);
                replace.execute(params![file.path, title, year, file.size_bytes, file.modified_at])?;
                summary.updated += 1;
            }
            Some(existing) if existing.missing || existing.modified_at != file.modified_at => {
                refresh.execute(params![file.path, file.modified_at])?;
                if existing.missing {
                    summary.updated += 1;
                }
            }
            Some(_) => {}
        }
    }

    let found: HashSet<&str> = scan.files.iter().map(|file| file.path.as_str()).collect();
    let unreadable = |path: &str| scan.unreadable_paths.iter().any(|skipped| Path::new(path).starts_with(skipped));
    for (path, existing) in &known {
        if !existing.missing && !found.contains(path.as_str()) && !unreadable(path) {
            mark_missing.execute([path])?;
            if Path::new(path).starts_with(&scan.root) {
                summary.missing += 1;
            }
        }
    }

    Ok(summary)
}

/// Movies currently present on disk, ordered by title.
pub fn list_movies(conn: &Connection) -> rusqlite::Result<Vec<MovieDto>> {
    let mut stmt = conn.prepare(
        "SELECT id, path, title, year, size_bytes, modified_at, added_at,
                duration_seconds, progress_seconds, last_played_at
         FROM movies WHERE missing = 0 ORDER BY title COLLATE NOCASE",
    )?;
    let rows = stmt.query_map([], |row| {
        Ok(MovieDto {
            id: row.get(0)?,
            path: row.get(1)?,
            title: row.get(2)?,
            year: row.get(3)?,
            size_bytes: row.get(4)?,
            modified_at: row.get(5)?,
            added_at: row.get(6)?,
            duration_seconds: row.get(7)?,
            progress_seconds: row.get(8)?,
            last_played_at: row.get(9)?,
        })
    })?;
    rows.collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use super::super::scanner::ScannedFile;
    use crate::db::open_in_memory;

    fn file(path: &str, size_bytes: i64, modified_at: i64) -> ScannedFile {
        ScannedFile { path: path.into(), size_bytes, modified_at }
    }

    fn scan(files: &[ScannedFile]) -> FolderScan {
        FolderScan { root: "/m".into(), files: files.to_vec(), unreadable_paths: Vec::new() }
    }

    fn titles(conn: &Connection) -> Vec<String> {
        list_movies(conn).unwrap().into_iter().map(|movie| movie.title).collect()
    }

    fn movie(conn: &Connection, title: &str) -> MovieDto {
        list_movies(conn).unwrap().into_iter().find(|movie| movie.title == title).unwrap()
    }

    #[test]
    fn first_scan_adds_and_parses_titles() {
        let conn = open_in_memory();
        let now = 1_793_000_000; // 2026-10-26; years after 2027 would be rejected as future
        let summary = apply_scan(&conn, &scan(&[file("/m/Arrival_2016.mkv", 10, 1)]), now).unwrap();

        assert_eq!(summary, ScanSummary { added: 1, updated: 0, missing: 0 });
        let movie = &list_movies(&conn).unwrap()[0];
        assert_eq!((movie.title.as_str(), movie.year, movie.added_at), ("Arrival", Some(2016), now));
    }

    #[test]
    fn rescan_detects_unchanged_changed_missing_and_refound() {
        let conn = open_in_memory();
        apply_scan(&conn, &scan(&[file("/m/A.mkv", 10, 1), file("/m/B.mkv", 10, 1)]), 100).unwrap();

        // A unchanged, B gone, C new.
        let summary = apply_scan(&conn, &scan(&[file("/m/A.mkv", 10, 1), file("/m/C.mkv", 5, 2)]), 200).unwrap();
        assert_eq!(summary, ScanSummary { added: 1, updated: 0, missing: 1 });
        assert_eq!(titles(&conn), vec!["A", "C"]);

        // B comes back unchanged and A changed size.
        let files = [file("/m/A.mkv", 11, 3), file("/m/B.mkv", 10, 1), file("/m/C.mkv", 5, 2)];
        let summary = apply_scan(&conn, &scan(&files), 300).unwrap();
        assert_eq!(summary, ScanSummary { added: 0, updated: 2, missing: 0 });
        assert_eq!(titles(&conn), vec!["A", "B", "C"]);

        // A re-found file keeps its original added date.
        assert_eq!(movie(&conn, "B").added_at, 100);
    }

    #[test]
    fn changed_file_clears_stale_metadata_but_refound_file_keeps_it() {
        let conn = open_in_memory();
        apply_scan(&conn, &scan(&[file("/m/A.mkv", 10, 1), file("/m/B.mkv", 10, 1)]), 100).unwrap();
        conn.execute("UPDATE movies SET duration_seconds = 6000, progress_seconds = 600", []).unwrap();

        apply_scan(&conn, &scan(&[file("/m/A.mkv", 10, 1)]), 200).unwrap(); // B goes missing
        apply_scan(&conn, &scan(&[file("/m/A.mkv", 99, 5), file("/m/B.mkv", 10, 1)]), 300).unwrap();

        let a = movie(&conn, "A");
        assert_eq!((a.duration_seconds, a.progress_seconds), (None, None));
        let b = movie(&conn, "B");
        assert_eq!((b.duration_seconds, b.progress_seconds), (Some(6000), Some(600)));
    }

    #[test]
    fn movies_under_unreadable_folders_are_not_marked_missing() {
        let conn = open_in_memory();
        apply_scan(&conn, &scan(&[file("/m/A.mkv", 1, 1), file("/m/Locked/B.mkv", 1, 1)]), 100).unwrap();

        let partial = FolderScan {
            root: "/m".into(),
            files: vec![file("/m/A.mkv", 1, 1)],
            unreadable_paths: vec!["/m/Locked".into()],
        };
        let summary = apply_scan(&conn, &partial, 200).unwrap();

        assert_eq!(summary.missing, 0);
        assert_eq!(titles(&conn), vec!["A", "B"]);
    }

    #[test]
    fn unreadable_file_is_not_marked_missing() {
        let conn = open_in_memory();
        apply_scan(&conn, &scan(&[file("/m/A.mkv", 1, 1), file("/m/B.mkv", 1, 1)]), 100).unwrap();

        let partial = FolderScan {
            root: "/m".into(),
            files: vec![file("/m/A.mkv", 1, 1)],
            unreadable_paths: vec!["/m/B.mkv".into()],
        };
        assert_eq!(apply_scan(&conn, &partial, 200).unwrap().missing, 0);
        assert_eq!(titles(&conn), vec!["A", "B"]);
    }

    #[test]
    fn touched_file_keeps_progress_and_is_not_reported() {
        let conn = open_in_memory();
        apply_scan(&conn, &scan(&[file("/m/A.mkv", 10, 1)]), 100).unwrap();
        conn.execute("UPDATE movies SET duration_seconds = 6000, progress_seconds = 600", []).unwrap();

        let summary = apply_scan(&conn, &scan(&[file("/m/A.mkv", 10, 99)]), 200).unwrap();

        assert_eq!(summary, ScanSummary::default());
        let a = movie(&conn, "A");
        assert_eq!((a.modified_at, a.duration_seconds, a.progress_seconds), (99, Some(6000), Some(600)));
    }

    #[test]
    fn switching_folders_hides_old_movies_without_reporting_them_missing() {
        let conn = open_in_memory();
        apply_scan(&conn, &scan(&[file("/m/A.mkv", 1, 1)]), 100).unwrap();

        let other = FolderScan { root: "/other".into(), files: vec![file("/other/B.mkv", 1, 1)], ..Default::default() };
        let summary = apply_scan(&conn, &other, 200).unwrap();

        assert_eq!(summary, ScanSummary { added: 1, updated: 0, missing: 0 });
        assert_eq!(titles(&conn), vec!["B"]);
    }
}
