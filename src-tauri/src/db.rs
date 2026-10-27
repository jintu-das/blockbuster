use std::path::Path;

use rusqlite::{Connection, OptionalExtension};

/// Schema migrations, applied in order. `PRAGMA user_version` records how many have run,
/// so only append new entries; never edit one that has shipped.
const MIGRATIONS: [&str; 3] = [
    // v1: library folder setting and the movie catalog.
    "CREATE TABLE settings (
        key   TEXT PRIMARY KEY,
        value TEXT NOT NULL
    );
    CREATE TABLE movies (
        id               INTEGER PRIMARY KEY,
        path             TEXT    NOT NULL UNIQUE,
        title            TEXT    NOT NULL,
        year             INTEGER,
        size_bytes       INTEGER NOT NULL,
        modified_at      INTEGER NOT NULL,
        added_at         INTEGER NOT NULL,
        missing          INTEGER NOT NULL DEFAULT 0,
        duration_seconds INTEGER,
        progress_seconds INTEGER,
        last_played_at   INTEGER
    );",
    // v2: video quality and duration from ffprobe, and a poster or frame thumbnail per movie.
    // `probed_size_bytes` is the file size ffprobe last read, so a changed file is probed again.
    // `poster_lookup` is 1 once OMDb has answered for the movie (found or not).
    "ALTER TABLE movies ADD COLUMN quality TEXT;
    ALTER TABLE movies ADD COLUMN probed_size_bytes INTEGER;
    ALTER TABLE movies ADD COLUMN thumbnail_file TEXT;
    ALTER TABLE movies ADD COLUMN poster_lookup INTEGER NOT NULL DEFAULT 0;",
    // v3: the file size at which ffmpeg could not grab a frame, so a broken or very short file
    // is not retried on every pass, only after it changes.
    "ALTER TABLE movies ADD COLUMN frame_failed_size INTEGER;",
];

pub fn open(path: &Path) -> rusqlite::Result<Connection> {
    let mut conn = Connection::open(path)?;
    migrate(&mut conn)?;
    Ok(conn)
}

pub fn migrate(conn: &mut Connection) -> rusqlite::Result<()> {
    let applied: i64 = conn.pragma_query_value(None, "user_version", |row| row.get(0))?;
    for (index, sql) in MIGRATIONS.iter().enumerate().skip(applied as usize) {
        let tx = conn.transaction()?;
        tx.execute_batch(sql)?;
        tx.pragma_update(None, "user_version", (index + 1) as i64)?;
        tx.commit()?;
    }
    Ok(())
}

pub fn get_setting(conn: &Connection, key: &str) -> rusqlite::Result<Option<String>> {
    conn.query_row("SELECT value FROM settings WHERE key = ?1", [key], |row| row.get(0))
        .optional()
}

pub fn set_setting(conn: &Connection, key: &str, value: &str) -> rusqlite::Result<()> {
    conn.execute(
        "INSERT INTO settings (key, value) VALUES (?1, ?2)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        [key, value],
    )?;
    Ok(())
}

#[cfg(test)]
pub fn open_in_memory() -> Connection {
    let mut conn = Connection::open_in_memory().unwrap();
    migrate(&mut conn).unwrap();
    conn
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn migrations_are_idempotent() {
        let mut conn = open_in_memory();
        migrate(&mut conn).unwrap();
        let version: i64 = conn.pragma_query_value(None, "user_version", |row| row.get(0)).unwrap();
        assert_eq!(version, MIGRATIONS.len() as i64);
    }

    #[test]
    fn settings_round_trip_and_overwrite() {
        let conn = open_in_memory();
        assert_eq!(get_setting(&conn, "library_folder").unwrap(), None);
        set_setting(&conn, "library_folder", "/a").unwrap();
        set_setting(&conn, "library_folder", "/b").unwrap();
        assert_eq!(get_setting(&conn, "library_folder").unwrap().as_deref(), Some("/b"));
    }
}
