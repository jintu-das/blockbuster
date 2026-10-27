use std::path::Path;

use rusqlite::{Connection, OptionalExtension};

/// Schema migrations, applied in order. `PRAGMA user_version` records how many have run,
/// so only append new entries; never edit one that has shipped.
const MIGRATIONS: [&str; 5] = [
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
    // v4: the raw OMDb reply and ffprobe's stream list, for the details page. Movies OMDb already
    // matched are looked up once more to store the reply (misses stay misses), and every file is
    // probed again for its streams.
    "ALTER TABLE movies ADD COLUMN omdb_json TEXT;
    ALTER TABLE movies ADD COLUMN media_json TEXT;
    UPDATE movies SET poster_lookup = 0 WHERE thumbnail_file LIKE '%-poster.jpg';
    UPDATE movies SET probed_size_bytes = NULL;",
    // v5: `details_lookup` is 1 once OMDb has answered a lookup that stores its reply (found or
    // not). Every movie without a stored reply gets one more lookup, including ones v4 skipped
    // (matched without a usable poster) and ones OMDb missed before.
    "ALTER TABLE movies ADD COLUMN details_lookup INTEGER NOT NULL DEFAULT 0;
    UPDATE movies SET details_lookup = 1 WHERE omdb_json IS NOT NULL;",
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

    /// A database as an older app version left it.
    fn migrated_to(version: usize) -> Connection {
        let conn = Connection::open_in_memory().unwrap();
        for sql in &MIGRATIONS[..version] {
            conn.execute_batch(sql).unwrap();
        }
        conn.pragma_update(None, "user_version", version as i64).unwrap();
        conn
    }

    #[test]
    fn v4_catches_up_matched_posters_and_probes_again() {
        let mut conn = migrated_to(3);
        conn.execute_batch(
            "INSERT INTO movies (id, path, title, size_bytes, modified_at, added_at, probed_size_bytes,
                                 thumbnail_file, poster_lookup)
             VALUES (1, '/a.mkv', 'A', 100, 1, 1, 100, '1-poster.jpg', 1),
                    (2, '/b.mkv', 'B', 100, 1, 1, 100, '2-frame.jpg', 1);",
        )
        .unwrap();

        migrate(&mut conn).unwrap();
        let rows: Vec<(i64, bool, Option<i64>)> = conn
            .prepare("SELECT id, poster_lookup, probed_size_bytes FROM movies ORDER BY id")
            .unwrap()
            .query_map([], |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)))
            .unwrap()
            .collect::<rusqlite::Result<_>>()
            .unwrap();
        assert_eq!(rows, vec![(1, false, None), (2, true, None)]);
    }

    #[test]
    fn v5_marks_only_stored_replies_as_looked_up() {
        let mut conn = migrated_to(4);
        conn.execute_batch(
            "INSERT INTO movies (id, path, title, size_bytes, modified_at, added_at, poster_lookup, omdb_json)
             VALUES (1, '/a.mkv', 'A', 100, 1, 1, 1, '{}'),
                    (2, '/b.mkv', 'B', 100, 1, 1, 1, NULL);",
        )
        .unwrap();

        migrate(&mut conn).unwrap();
        let looked_up: Vec<bool> = conn
            .prepare("SELECT details_lookup FROM movies ORDER BY id")
            .unwrap()
            .query_map([], |row| row.get(0))
            .unwrap()
            .collect::<rusqlite::Result<_>>()
            .unwrap();
        assert_eq!(looked_up, vec![true, false]);
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
