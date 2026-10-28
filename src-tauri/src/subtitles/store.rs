use std::path::{Path, PathBuf};

use rusqlite::{params, Connection, OptionalExtension};
use serde::Serialize;

use super::sidecar::Sidecar;

/// The subtitle remembered for a movie, stored in `movies.subtitle_choice` as text. No choice
/// (`NULL`) lets mpv decide.
#[derive(Debug, Clone, PartialEq)]
pub enum Choice {
    Off,
    /// The n-th subtitle stream inside the video (1-based, in ffprobe's order).
    Embedded(u32),
    /// A file next to the video, by name.
    Sidecar(String),
    /// A subtitle the user added, by `subtitles.id`.
    Added(i64),
}

impl Choice {
    pub fn parse(text: &str) -> Option<Choice> {
        match text.split_once(':') {
            None if text == "off" => Some(Choice::Off),
            Some(("embedded", n)) => n.parse().ok().filter(|&n| n > 0).map(Choice::Embedded),
            // A bare file name only: a path could point anywhere on disk.
            Some(("sidecar", name)) if !name.is_empty() && !name.contains('/') => Some(Choice::Sidecar(name.to_string())),
            Some(("added", id)) => id.parse().ok().map(Choice::Added),
            _ => None,
        }
    }

    pub fn to_text(&self) -> String {
        match self {
            Choice::Off => "off".to_string(),
            Choice::Embedded(n) => format!("embedded:{n}"),
            Choice::Sidecar(name) => format!("sidecar:{name}"),
            Choice::Added(id) => format!("added:{id}"),
        }
    }
}

/// A subtitle the user added, as listed on the details page.
#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AddedSubtitle {
    pub id: i64,
    /// File name under `<app data>/subtitles/`.
    #[serde(skip)]
    pub file: String,
    /// The original file name, or the OpenSubtitles release name.
    pub label: String,
    pub language: Option<String>,
    /// "file" or "opensubtitles".
    pub source: String,
    pub added_at: i64,
}

/// A subtitle about to be stored; the file name is assigned from the new row's id.
pub struct NewSubtitle<'a> {
    pub movie_id: i64,
    pub label: &'a str,
    pub language: Option<&'a str>,
    pub source: &'a str,
    pub source_id: Option<&'a str>,
    pub format: &'a str,
    pub now: i64,
}

/// Which subtitle mpv should start with.
#[derive(Debug, Clone, Default, PartialEq)]
pub enum Selection {
    /// Leave it to mpv and the user's mpv config (no choice, or the chosen subtitle is gone).
    #[default]
    Auto,
    Off,
    /// The n-th subtitle stream inside the video. If the video has fewer, mpv decides.
    Embedded(u32),
    /// A sidecar file, loaded with `--sub-file`.
    Sidecar(PathBuf),
    /// An added subtitle, also listed in `SubtitlePlan::added`.
    Added(PathBuf),
}

/// The subtitles to give mpv and the one to select.
#[derive(Debug, Clone, Default, PartialEq)]
pub struct SubtitlePlan {
    /// Files next to the video, loaded with `--sub-file` (mpv's own sidecar loading skips files
    /// already loaded, so nothing appears twice).
    pub sidecars: Vec<PathBuf>,
    /// Added subtitles. They are added once the file has loaded, unselected unless chosen, so
    /// Automatic keeps mpv's own pick.
    pub added: Vec<PathBuf>,
    pub select: Selection,
}

impl SubtitlePlan {
    /// Whether the session has to watch mpv's track list to finish setting subtitles up.
    pub fn needs_tracks(&self) -> bool {
        !self.added.is_empty() || matches!(self.select, Selection::Embedded(_) | Selection::Sidecar(_))
    }
}

pub fn choice(conn: &Connection, movie_id: i64) -> rusqlite::Result<Option<Choice>> {
    let text: Option<String> = conn
        .query_row("SELECT subtitle_choice FROM movies WHERE id = ?1", [movie_id], |row| row.get(0))
        .optional()?
        .flatten();
    Ok(text.as_deref().and_then(Choice::parse))
}

pub fn set_choice(conn: &Connection, movie_id: i64, choice: Option<&Choice>) -> rusqlite::Result<()> {
    conn.execute(
        "UPDATE movies SET subtitle_choice = ?2 WHERE id = ?1",
        params![movie_id, choice.map(Choice::to_text)],
    )?;
    Ok(())
}

const ADDED_COLUMNS: &str = "id, file, label, language, source, added_at";

/// Maps the `ADDED_COLUMNS` at the start of a row.
fn added_from_row(row: &rusqlite::Row) -> rusqlite::Result<AddedSubtitle> {
    Ok(AddedSubtitle {
        id: row.get(0)?,
        file: row.get(1)?,
        label: row.get(2)?,
        language: row.get(3)?,
        source: row.get(4)?,
        added_at: row.get(5)?,
    })
}

pub fn list_added(conn: &Connection, movie_id: i64) -> rusqlite::Result<Vec<AddedSubtitle>> {
    let mut stmt = conn.prepare_cached(&format!(
        "SELECT {ADDED_COLUMNS} FROM subtitles WHERE movie_id = ?1 ORDER BY added_at, id"
    ))?;
    let rows = stmt.query_map([movie_id], added_from_row)?;
    rows.collect()
}

/// An added subtitle and the movie it belongs to.
pub fn added(conn: &Connection, id: i64) -> rusqlite::Result<Option<(i64, AddedSubtitle)>> {
    conn.query_row(&format!("SELECT {ADDED_COLUMNS}, movie_id FROM subtitles WHERE id = ?1"), [id], |row| {
        Ok((row.get(6)?, added_from_row(row)?))
    })
    .optional()
}

/// The subtitle already downloaded for the movie from this source file, if any.
pub fn find_by_source(conn: &Connection, movie_id: i64, source: &str, source_id: &str) -> rusqlite::Result<Option<AddedSubtitle>> {
    conn.query_row(
        &format!("SELECT {ADDED_COLUMNS} FROM subtitles WHERE movie_id = ?1 AND source = ?2 AND source_id = ?3"),
        params![movie_id, source, source_id],
        added_from_row,
    )
    .optional()
}

/// Inserts a row and names its file `<id>.<format>`, so names never collide. Both writes are
/// one transaction, so no row is ever left without a file name.
pub fn insert_added(conn: &Connection, new: &NewSubtitle) -> rusqlite::Result<AddedSubtitle> {
    let tx = conn.unchecked_transaction()?;
    tx.execute(
        "INSERT INTO subtitles (movie_id, file, label, language, source, source_id, added_at)
         VALUES (?1, '', ?2, ?3, ?4, ?5, ?6)",
        params![new.movie_id, new.label, new.language, new.source, new.source_id, new.now],
    )?;
    let id = tx.last_insert_rowid();
    let file = format!("{id}.{}", new.format);
    tx.execute("UPDATE subtitles SET file = ?2 WHERE id = ?1", params![id, file])?;
    tx.commit()?;
    Ok(AddedSubtitle {
        id,
        file,
        label: new.label.to_string(),
        language: new.language.map(str::to_string),
        source: new.source.to_string(),
        added_at: new.now,
    })
}

/// Deletes an added subtitle and, in the same transaction, forgets it as the movie's choice.
/// Returns its file name, for the caller to delete after this has committed.
pub fn remove_added(conn: &Connection, id: i64) -> rusqlite::Result<Option<String>> {
    let tx = conn.unchecked_transaction()?;
    let Some((movie_id, subtitle)) = added(&tx, id)? else { return Ok(None) };
    tx.execute("DELETE FROM subtitles WHERE id = ?1", [id])?;
    if choice(&tx, movie_id)? == Some(Choice::Added(id)) {
        set_choice(&tx, movie_id, None)?;
    }
    tx.commit()?;
    Ok(Some(subtitle.file))
}

/// What an online search needs to know about a movie on disk.
pub struct SearchHints {
    pub path: String,
    pub title: String,
    pub year: Option<i32>,
    /// From the stored OMDb reply, e.g. "tt0133093".
    pub imdb_id: Option<String>,
}

pub fn search_hints(conn: &Connection, movie_id: i64) -> rusqlite::Result<Option<SearchHints>> {
    conn.query_row(
        "SELECT path, title, year,
                CASE WHEN json_valid(omdb_json) THEN json_extract(omdb_json, '$.imdbID') END
         FROM movies WHERE id = ?1 AND missing = 0",
        [movie_id],
        |row| Ok(SearchHints { path: row.get(0)?, title: row.get(1)?, year: row.get(2)?, imdb_id: row.get(3)? }),
    )
    .optional()
}

/// What to give mpv for `movie_id`. `sidecars` are the video's sidecar files (from
/// `sidecar::find_sidecars`, read before taking the DB lock so a slow folder doesn't block other
/// commands). Added subtitles whose file is gone are skipped, and a choice whose subtitle is
/// gone falls back to `Auto`.
pub fn playback_plan(
    conn: &Connection,
    movie_id: i64,
    video: &Path,
    sidecars: &[Sidecar],
    added_dir: &Path,
) -> rusqlite::Result<SubtitlePlan> {
    let added: Vec<(i64, PathBuf)> = list_added(conn, movie_id)?
        .into_iter()
        .map(|subtitle| (subtitle.id, added_dir.join(subtitle.file)))
        .filter(|(_, path)| path.is_file())
        .collect();

    let select = match choice(conn, movie_id)? {
        None => Selection::Auto,
        Some(Choice::Off) => Selection::Off,
        Some(Choice::Embedded(n)) => Selection::Embedded(n),
        Some(Choice::Sidecar(name)) => match sidecars.iter().any(|sidecar| sidecar.file_name == name) {
            true => Selection::Sidecar(video.with_file_name(name)),
            false => Selection::Auto,
        },
        Some(Choice::Added(id)) => added
            .iter()
            .find(|(added_id, _)| *added_id == id)
            .map_or(Selection::Auto, |(_, path)| Selection::Added(path.clone())),
    };
    Ok(SubtitlePlan {
        sidecars: sidecars.iter().map(|sidecar| video.with_file_name(&sidecar.file_name)).collect(),
        added: added.into_iter().map(|(_, path)| path).collect(),
        select,
    })
}

#[cfg(test)]
mod tests {
    use std::fs;

    use super::*;
    use crate::db::open_in_memory;
    use crate::subtitles::sidecar;

    fn movie(conn: &Connection, id: i64, path: &str) {
        conn.execute(
            "INSERT INTO movies (id, path, title, size_bytes, modified_at, added_at) VALUES (?1, ?2, 'A', 1, 1, 1)",
            params![id, path],
        )
        .unwrap();
    }

    fn new(movie_id: i64, label: &str) -> NewSubtitle<'_> {
        NewSubtitle { movie_id, label, language: Some("en"), source: "file", source_id: None, format: "srt", now: 100 }
    }

    #[test]
    fn choices_round_trip_and_reject_bad_text() {
        for choice in [Choice::Off, Choice::Embedded(2), Choice::Sidecar("A.en.srt".into()), Choice::Added(7)] {
            assert_eq!(Choice::parse(&choice.to_text()), Some(choice));
        }
        for bad in ["", "on", "embedded:0", "embedded:x", "sidecar:", "sidecar:../x.srt", "added:", "other:1"] {
            assert_eq!(Choice::parse(bad), None, "{bad}");
        }
    }

    #[test]
    fn added_subtitles_get_unique_files_and_removal_clears_the_choice() {
        let conn = open_in_memory();
        movie(&conn, 1, "/m/A.mkv");
        let first = insert_added(&conn, &new(1, "A.en.srt")).unwrap();
        let second = insert_added(&conn, &new(1, "A.fr.srt")).unwrap();
        assert_eq!((first.file.as_str(), second.file.as_str()), ("1.srt", "2.srt"));
        assert_eq!(list_added(&conn, 1).unwrap(), vec![first.clone(), second.clone()]);

        set_choice(&conn, 1, Some(&Choice::Added(first.id))).unwrap();
        assert_eq!(remove_added(&conn, first.id).unwrap().as_deref(), Some("1.srt"));
        assert_eq!(choice(&conn, 1).unwrap(), None);
        assert_eq!(remove_added(&conn, first.id).unwrap(), None, "already gone");

        set_choice(&conn, 1, Some(&Choice::Off)).unwrap();
        remove_added(&conn, second.id).unwrap();
        assert_eq!(choice(&conn, 1).unwrap(), Some(Choice::Off), "other choices are kept");
    }

    #[test]
    fn finds_downloads_by_source_id() {
        let conn = open_in_memory();
        movie(&conn, 1, "/m/A.mkv");
        let subtitle = insert_added(
            &conn,
            &NewSubtitle { source: "opensubtitles", source_id: Some("123"), ..new(1, "Release") },
        )
        .unwrap();
        assert_eq!(find_by_source(&conn, 1, "opensubtitles", "123").unwrap(), Some(subtitle));
        assert_eq!(find_by_source(&conn, 2, "opensubtitles", "123").unwrap(), None);
    }

    #[test]
    fn playback_plan_loads_existing_files_and_falls_back_to_auto() {
        let conn = open_in_memory();
        let media = tempfile::tempdir().unwrap();
        let added_dir = tempfile::tempdir().unwrap();
        let video = media.path().join("A.mkv");
        fs::write(&video, "").unwrap();
        fs::write(media.path().join("A.en.srt"), "").unwrap();
        movie(&conn, 1, video.to_str().unwrap());
        let kept = insert_added(&conn, &new(1, "kept.srt")).unwrap();
        fs::write(added_dir.path().join(&kept.file), "").unwrap();
        let lost = insert_added(&conn, &new(1, "lost.srt")).unwrap();
        let sidecars = sidecar::find_sidecars(&video);

        let plan = |choice: Option<Choice>| {
            set_choice(&conn, 1, choice.as_ref()).unwrap();
            playback_plan(&conn, 1, &video, &sidecars, added_dir.path()).unwrap()
        };

        let auto = plan(None);
        assert_eq!(auto.sidecars, vec![media.path().join("A.en.srt")]);
        assert_eq!(auto.added, vec![added_dir.path().join(&kept.file)], "the missing file is skipped");
        assert_eq!(auto.select, Selection::Auto);
        assert_eq!(plan(Some(Choice::Off)).select, Selection::Off);
        assert_eq!(plan(Some(Choice::Embedded(2))).select, Selection::Embedded(2));
        assert_eq!(
            plan(Some(Choice::Sidecar("A.en.srt".into()))).select,
            Selection::Sidecar(media.path().join("A.en.srt"))
        );
        assert_eq!(plan(Some(Choice::Added(kept.id))).select, Selection::Added(added_dir.path().join(&kept.file)));
        assert_eq!(plan(Some(Choice::Sidecar("A.fr.srt".into()))).select, Selection::Auto, "deleted sidecar");
        assert_eq!(plan(Some(Choice::Added(lost.id))).select, Selection::Auto, "added file missing");
    }

    #[test]
    fn only_some_plans_need_the_track_list() {
        let plan = |added: Vec<PathBuf>, select| SubtitlePlan { sidecars: vec!["/m/A.srt".into()], added, select };
        assert!(!plan(vec![], Selection::Auto).needs_tracks());
        assert!(!plan(vec![], Selection::Off).needs_tracks());
        assert!(plan(vec![], Selection::Embedded(1)).needs_tracks());
        assert!(plan(vec![], Selection::Sidecar("/m/A.srt".into())).needs_tracks());
        assert!(plan(vec!["/d/1.srt".into()], Selection::Auto).needs_tracks());
    }
}
