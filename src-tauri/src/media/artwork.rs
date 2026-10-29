//! Large posters for full-width artwork (the Home billboard, the details page hero). Thumbnails
//! stay small so poster grids load quickly; the large version is downloaded the first time a
//! banner asks for it and kept next to the thumbnail.

use std::collections::HashSet;
use std::path::{Path, PathBuf};
use std::sync::Mutex;

use rusqlite::{Connection, OptionalExtension};

use super::poster;

pub struct LargePosters {
    agent: ureq::Agent,
    /// Movies whose large poster couldn't be fetched this session: they use the thumbnail until
    /// the app restarts. Held for the whole download, so one file is never fetched twice at once.
    failed: Mutex<HashSet<i64>>,
}

impl LargePosters {
    pub fn new() -> Self {
        LargePosters { agent: poster::http_agent(), failed: Mutex::default() }
    }

    /// The large poster for movie `id`, downloaded from `poster_url` on first use. `None` when
    /// there is no OMDb poster, the link has no large version, or fetching it failed.
    pub fn get(&self, dir: &Path, id: i64, poster_url: Option<&str>) -> Option<PathBuf> {
        let dest = large_poster_path(dir, id);
        if dest.exists() {
            return Some(dest);
        }
        let url = poster_url.and_then(poster::large_poster_url)?;
        let mut failed = self.failed.lock().ok()?;
        // Another request may have finished the download while this one waited for the lock.
        if dest.exists() {
            return Some(dest);
        }
        if failed.contains(&id) {
            return None;
        }
        match poster::download(&self.agent, &url, &dest) {
            Ok(true) => return Some(dest),
            Ok(false) => {}
            Err(error) => eprintln!("blockbuster: large poster for movie {id} failed: {error}"),
        }
        failed.insert(id);
        None
    }
}

pub fn large_poster_path(dir: &Path, id: i64) -> PathBuf {
    dir.join(format!("{id}-poster-large.jpg"))
}

/// OMDb's poster link for a movie whose thumbnail is that poster (not an ffmpeg frame).
pub fn poster_url(conn: &Connection, id: i64) -> rusqlite::Result<Option<String>> {
    conn.query_row(
        "SELECT json_extract(omdb_json, '$.Poster') FROM movies
         WHERE id = ?1 AND thumbnail_file LIKE '%-poster.jpg'",
        [id],
        |row| row.get(0),
    )
    .optional()
    .map(Option::flatten)
}

#[cfg(test)]
mod tests {
    use rusqlite::params;

    use super::*;
    use crate::db::open_in_memory;

    fn insert(conn: &Connection, id: i64, thumbnail_file: Option<&str>, omdb_json: Option<&str>) {
        conn.execute(
            "INSERT INTO movies (id, path, title, size_bytes, modified_at, added_at, thumbnail_file, omdb_json)
             VALUES (?1, ?2, 'A', 100, 1, 1, ?3, ?4)",
            params![id, format!("/m/{id}.mkv"), thumbnail_file, omdb_json],
        )
        .unwrap();
    }

    #[test]
    fn only_a_poster_thumbnail_has_a_poster_url() {
        let conn = open_in_memory();
        let json = r#"{"Poster":"https://m.media-amazon.com/x._V1_SX300.jpg"}"#;
        insert(&conn, 1, Some("1-poster.jpg"), Some(json));
        insert(&conn, 2, Some("2-frame.jpg"), Some(json));
        insert(&conn, 3, None, None);

        assert_eq!(poster_url(&conn, 1).unwrap().as_deref(), Some("https://m.media-amazon.com/x._V1_SX300.jpg"));
        assert_eq!(poster_url(&conn, 2).unwrap(), None, "a frame thumbnail has no poster to enlarge");
        assert_eq!(poster_url(&conn, 3).unwrap(), None);
        assert_eq!(poster_url(&conn, 4).unwrap(), None);
    }

    #[test]
    fn a_downloaded_large_poster_is_reused_without_a_link() {
        let dir = tempfile::tempdir().unwrap();
        std::fs::write(large_poster_path(dir.path(), 7), b"jpeg").unwrap();
        assert_eq!(LargePosters::new().get(dir.path(), 7, None), Some(large_poster_path(dir.path(), 7)));
        assert_eq!(LargePosters::new().get(dir.path(), 8, Some("N/A")), None);
    }

    #[test]
    #[ignore = "downloads from Amazon's image service"]
    fn real_large_poster_is_downloaded_once() {
        let dir = tempfile::tempdir().unwrap();
        let posters = LargePosters::new();
        let url = "https://m.media-amazon.com/images/M/MV5BNDFkMTRkZmQtM2I0NC00NjJjLWJlMDctNTNiZWYxYzhjZDZiXkEyXkFqcGc@._V1_QL75_UY562_CR1,0,380,562_.jpg";
        let path = posters.get(dir.path(), 1, Some(url)).expect("downloaded");
        let bytes = std::fs::read(&path).unwrap();
        assert!(bytes.starts_with(&[0xFF, 0xD8]), "a JPEG");
        assert!(bytes.len() > 100_000, "much larger than the 380 px thumbnail");
        assert_eq!(posters.get(dir.path(), 1, None), Some(path), "reused from disk");
    }
}
