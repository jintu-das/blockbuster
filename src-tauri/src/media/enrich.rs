use std::fs::{self, File};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering::SeqCst};
use std::thread;
use std::time::{Duration, Instant};

use rusqlite::{params, Connection};
use tauri::{AppHandle, Emitter, Manager};

use super::poster::{self, Omdb};
use super::probe::{self, Probe};
use crate::library::commands::with_conn;

/// Emitted while a pass runs, so the UI can show qualities and thumbnails as they arrive.
const LIBRARY_UPDATED_EVENT: &str = "library-updated";
/// Each event makes the UI refetch the whole catalog, so they are spaced out in time rather
/// than sent per movie.
const EMIT_INTERVAL: Duration = Duration::from_secs(3);
/// Where to grab a frame when the duration is unknown.
const DEFAULT_FRAME_SECONDS: i64 = 60;

/// Background metadata state, held in Tauri managed state.
pub struct Enrichment {
    pub thumbnails_dir: PathBuf,
    omdb: Option<Omdb>,
    gate: PassGate,
}

impl Enrichment {
    /// Posters are only looked up when `omdb_api_key` is set; otherwise every movie gets a frame.
    pub fn new(thumbnails_dir: PathBuf, omdb_api_key: Option<String>) -> Self {
        Enrichment {
            thumbnails_dir,
            omdb: omdb_api_key.filter(|key| !key.is_empty()).map(Omdb::new),
            gate: PassGate::default(),
        }
    }
}

/// Makes sure at most one worker runs passes, and that a pass requested while one is running
/// is not lost: the running worker does one more.
#[derive(Default)]
struct PassGate {
    running: AtomicBool,
    rerun: AtomicBool,
}

impl PassGate {
    /// Asks for a pass. Returns true when the caller must start a worker.
    fn request(&self) -> bool {
        self.rerun.store(true, SeqCst);
        !self.running.swap(true, SeqCst)
    }

    /// Called by the worker before each pass. Returns false when it should exit.
    fn next(&self) -> bool {
        loop {
            if self.rerun.swap(false, SeqCst) {
                return true;
            }
            self.running.store(false, SeqCst);
            // A request between the check above and `running = false` started no worker, so
            // take it here, unless a new worker already has.
            if !self.rerun.load(SeqCst) || self.running.swap(true, SeqCst) {
                return false;
            }
        }
    }
}

/// Starts a pass on its own thread, or queues one more if a pass is already running.
pub fn spawn(app: &AppHandle) {
    if !app.state::<Enrichment>().gate.request() {
        return;
    }
    let app = app.clone();
    thread::spawn(move || {
        let state = app.state::<Enrichment>();
        while state.gate.next() {
            if let Err(error) = run_pass(&app, &state) {
                eprintln!("blockbuster: metadata pass failed: {error}");
            }
        }
    });
}

#[derive(Debug, PartialEq)]
struct Pending {
    id: i64,
    path: String,
    title: String,
    year: Option<i32>,
    size_bytes: i64,
    duration_seconds: Option<i64>,
    probed: bool,
    thumbnail_file: Option<String>,
    poster_lookup: bool,
    frame_failed: bool,
}

/// Which external tools still work this pass. One failure (not installed, no network, bad key)
/// stops further attempts until the next pass, without marking movies as done.
struct Tools {
    ffprobe: bool,
    ffmpeg: bool,
    omdb: bool,
}

fn run_pass(app: &AppHandle, state: &Enrichment) -> Result<(), String> {
    fs::create_dir_all(&state.thumbnails_dir).map_err(|error| error.to_string())?;
    forget_deleted_thumbnails(app, &state.thumbnails_dir)?;
    let pending = with_conn(app, |conn| pending(conn, state.omdb.is_some()))?;
    let mut tools = Tools { ffprobe: true, ffmpeg: true, omdb: state.omdb.is_some() };
    let mut unannounced = false;
    let mut last_emit = Instant::now();
    for movie in pending {
        let (id, title) = (movie.id, movie.title.clone());
        match enrich(app, state, &mut tools, movie) {
            Ok(changed) => unannounced |= changed,
            // One movie's failure must not cost the rest of the pass; it stays pending.
            Err(error) => eprintln!("blockbuster: metadata for {title} (#{id}) failed: {error}"),
        }
        if unannounced && last_emit.elapsed() >= EMIT_INTERVAL {
            let _ = app.emit(LIBRARY_UPDATED_EVENT, ());
            unannounced = false;
            last_emit = Instant::now();
        }
    }
    if unannounced {
        let _ = app.emit(LIBRARY_UPDATED_EVENT, ());
    }
    Ok(())
}

/// Forgets thumbnails whose file is gone (e.g. the folder was cleared), so this pass makes them
/// again. Files are checked outside the database lock.
fn forget_deleted_thumbnails(app: &AppHandle, thumbnails_dir: &Path) -> Result<(), String> {
    let thumbnails = with_conn(app, |conn| {
        let mut stmt = conn.prepare("SELECT id, thumbnail_file FROM movies WHERE thumbnail_file IS NOT NULL")?;
        let rows = stmt.query_map([], |row| Ok((row.get::<_, i64>(0)?, row.get::<_, String>(1)?)))?;
        rows.collect::<rusqlite::Result<Vec<_>>>()
    })?;
    let deleted: Vec<i64> =
        thumbnails.into_iter().filter(|(_, file)| !thumbnails_dir.join(file).exists()).map(|(id, _)| id).collect();
    if deleted.is_empty() {
        return Ok(());
    }
    with_conn(app, |conn| deleted.iter().try_for_each(|id| forget_thumbnail(conn, *id)))
}

fn pending(conn: &Connection, has_omdb: bool) -> rusqlite::Result<Vec<Pending>> {
    let mut stmt = conn.prepare(
        "SELECT id, path, title, year, size_bytes, duration_seconds, probed_size_bytes IS size_bytes,
                thumbnail_file, poster_lookup, frame_failed_size IS size_bytes
         FROM movies
         WHERE missing = 0
           AND (probed_size_bytes IS NOT size_bytes
                OR (thumbnail_file IS NULL AND frame_failed_size IS NOT size_bytes)
                OR (?1 AND poster_lookup = 0))
         ORDER BY title COLLATE NOCASE",
    )?;
    let rows = stmt.query_map([has_omdb], |row| {
        Ok(Pending {
            id: row.get(0)?,
            path: row.get(1)?,
            title: row.get(2)?,
            year: row.get(3)?,
            size_bytes: row.get(4)?,
            duration_seconds: row.get(5)?,
            probed: row.get(6)?,
            thumbnail_file: row.get(7)?,
            poster_lookup: row.get(8)?,
            frame_failed: row.get(9)?,
        })
    })?;
    rows.collect()
}

/// Fills in what `movie` is missing. Returns whether anything visible changed.
fn enrich(app: &AppHandle, state: &Enrichment, tools: &mut Tools, mut movie: Pending) -> Result<bool, String> {
    let video = Path::new(&movie.path);
    // A file that can't be opened right now (e.g. a remounting drive) is skipped, not recorded
    // as unreadable, so a later pass tries it again.
    let readable = File::open(video).is_ok();
    let mut changed = false;

    if !movie.probed && readable && tools.ffprobe {
        match probe::probe(video) {
            Ok(probe) => {
                with_conn(app, |conn| save_probe(conn, movie.id, movie.size_bytes, &probe))?;
                movie.duration_seconds = movie.duration_seconds.or(probe.duration_seconds);
                changed = true;
            }
            Err(error) => {
                eprintln!("blockbuster: ffprobe unavailable: {error}");
                tools.ffprobe = false;
            }
        }
    }

    if let (Some(omdb), false, true) = (&state.omdb, movie.poster_lookup, tools.omdb) {
        let file = format!("{}-poster.jpg", movie.id);
        let downloaded = omdb
            .poster_url(&movie.title, movie.year)
            .and_then(|url| url.map_or(Ok(false), |url| omdb.download(&url, &state.thumbnails_dir.join(&file))));
        match downloaded {
            Ok(true) => {
                with_conn(app, |conn| save_poster(conn, movie.id, Some(&file)))?;
                if let Some(old) = movie.thumbnail_file.as_deref().filter(|old| *old != file) {
                    let _ = fs::remove_file(state.thumbnails_dir.join(old));
                }
                movie.thumbnail_file = Some(file);
                changed = true;
            }
            // OMDb answered: no poster, or a dead image link. Not asked again.
            Ok(false) => with_conn(app, |conn| save_poster(conn, movie.id, None))?,
            Err(error) => {
                eprintln!("blockbuster: poster lookup stopped for this pass: {error}");
                tools.omdb = false;
            }
        }
    }

    if movie.thumbnail_file.is_none() && !movie.frame_failed && readable && tools.ffmpeg {
        let file = format!("{}-frame.jpg", movie.id);
        let dest = state.thumbnails_dir.join(&file);
        // A tenth of the way in skips logos and opening credits. If that is past the end (a
        // short clip of unknown length), the first frame will do.
        let at_seconds = movie.duration_seconds.map_or(DEFAULT_FRAME_SECONDS, |duration| duration / 10);
        let grabbed = poster::extract_frame(video, at_seconds, &dest)
            .and_then(|grabbed| if grabbed || at_seconds == 0 { Ok(grabbed) } else { poster::extract_frame(video, 0, &dest) });
        match grabbed {
            Ok(true) => {
                with_conn(app, |conn| save_frame(conn, movie.id, &file))?;
                changed = true;
            }
            Ok(false) => with_conn(app, |conn| save_frame_failed(conn, movie.id, movie.size_bytes))?,
            Err(error) => {
                eprintln!("blockbuster: ffmpeg unavailable: {error}");
                tools.ffmpeg = false;
            }
        }
    }

    Ok(changed)
}

/// Stores a probe for the file version of `size_bytes`. The size check skips the write if a
/// rescan replaced the file meanwhile.
fn save_probe(conn: &Connection, id: i64, size_bytes: i64, probe: &Probe) -> rusqlite::Result<()> {
    conn.execute(
        "UPDATE movies
         SET quality = ?2, duration_seconds = COALESCE(duration_seconds, ?3), probed_size_bytes = ?4
         WHERE id = ?1 AND size_bytes = ?4",
        params![id, probe.quality, probe.duration_seconds, size_bytes],
    )?;
    Ok(())
}

/// Records that OMDb answered for the movie, with the downloaded poster if there is one.
fn save_poster(conn: &Connection, id: i64, poster: Option<&str>) -> rusqlite::Result<()> {
    conn.execute(
        "UPDATE movies SET poster_lookup = 1, thumbnail_file = COALESCE(?2, thumbnail_file) WHERE id = ?1",
        params![id, poster],
    )?;
    Ok(())
}

fn save_frame(conn: &Connection, id: i64, file: &str) -> rusqlite::Result<()> {
    conn.execute("UPDATE movies SET thumbnail_file = ?2 WHERE id = ?1", params![id, file])?;
    Ok(())
}

fn save_frame_failed(conn: &Connection, id: i64, size_bytes: i64) -> rusqlite::Result<()> {
    conn.execute("UPDATE movies SET frame_failed_size = ?2 WHERE id = ?1", params![id, size_bytes])?;
    Ok(())
}

/// Drops a movie's thumbnail whose file has gone missing, so the next pass makes a new one.
/// A lost poster is looked up again; a lost frame is grabbed again.
pub fn forget_thumbnail(conn: &Connection, id: i64) -> rusqlite::Result<()> {
    conn.execute(
        "UPDATE movies
         SET poster_lookup = CASE WHEN thumbnail_file LIKE '%-poster.jpg' THEN 0 ELSE poster_lookup END,
             thumbnail_file = NULL, frame_failed_size = NULL
         WHERE id = ?1",
        [id],
    )?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::open_in_memory;

    fn insert(conn: &Connection, id: i64, title: &str) {
        conn.execute(
            "INSERT INTO movies (id, path, title, size_bytes, modified_at, added_at) VALUES (?1, ?2, ?3, 100, 1, 1)",
            params![id, format!("/m/{title}.mkv"), title],
        )
        .unwrap();
    }

    fn pending_ids(conn: &Connection, has_omdb: bool) -> Vec<i64> {
        pending(conn, has_omdb).unwrap().into_iter().map(|movie| movie.id).collect()
    }

    fn probe_1080p() -> Probe {
        Probe { quality: Some("1080p".into()), duration_seconds: Some(6000) }
    }

    #[test]
    fn new_movies_are_pending_until_probed_and_thumbnailed() {
        let conn = open_in_memory();
        insert(&conn, 1, "A");
        assert_eq!(pending_ids(&conn, false), vec![1]);

        save_probe(&conn, 1, 100, &probe_1080p()).unwrap();
        assert_eq!(pending_ids(&conn, false), vec![1], "still needs a thumbnail");

        save_frame(&conn, 1, "1-frame.jpg").unwrap();
        assert!(pending_ids(&conn, false).is_empty());
        assert_eq!(pending_ids(&conn, true), vec![1], "a key brings back movies never looked up");

        save_poster(&conn, 1, Some("1-poster.jpg")).unwrap();
        assert!(pending_ids(&conn, true).is_empty());
    }

    #[test]
    fn a_changed_file_is_probed_again() {
        let conn = open_in_memory();
        insert(&conn, 1, "A");
        save_probe(&conn, 1, 100, &probe_1080p()).unwrap();
        save_frame(&conn, 1, "1-frame.jpg").unwrap();

        conn.execute("UPDATE movies SET size_bytes = 200", []).unwrap();
        let movie = &pending(&conn, false).unwrap()[0];
        assert!(!movie.probed);

        // A probe of the old file version must not mark the new one as probed.
        save_probe(&conn, 1, 100, &probe_1080p()).unwrap();
        assert!(!pending(&conn, false).unwrap()[0].probed);
    }

    #[test]
    fn a_failed_frame_waits_for_the_file_to_change() {
        let conn = open_in_memory();
        insert(&conn, 1, "A");
        save_probe(&conn, 1, 100, &Probe::default()).unwrap();
        save_frame_failed(&conn, 1, 100).unwrap();
        assert!(pending_ids(&conn, false).is_empty());

        conn.execute("UPDATE movies SET size_bytes = 200", []).unwrap();
        let movie = &pending(&conn, false).unwrap()[0];
        assert!(!movie.frame_failed);
    }

    #[test]
    fn a_missed_poster_lookup_is_not_repeated() {
        let conn = open_in_memory();
        insert(&conn, 1, "A");
        save_probe(&conn, 1, 100, &probe_1080p()).unwrap();
        save_frame(&conn, 1, "1-frame.jpg").unwrap();
        save_poster(&conn, 1, None).unwrap();

        assert!(pending_ids(&conn, true).is_empty());
        let file: String = conn.query_row("SELECT thumbnail_file FROM movies", [], |row| row.get(0)).unwrap();
        assert_eq!(file, "1-frame.jpg", "a miss keeps the frame");
    }

    #[test]
    fn a_lost_thumbnail_is_made_again() {
        let conn = open_in_memory();
        insert(&conn, 1, "Poster");
        insert(&conn, 2, "Frame");
        for id in [1, 2] {
            save_probe(&conn, id, 100, &probe_1080p()).unwrap();
        }
        save_poster(&conn, 1, Some("1-poster.jpg")).unwrap();
        save_frame(&conn, 2, "2-frame.jpg").unwrap();
        save_poster(&conn, 2, None).unwrap();

        forget_thumbnail(&conn, 1).unwrap();
        forget_thumbnail(&conn, 2).unwrap();

        let movies = pending(&conn, true).unwrap();
        assert_eq!(movies.iter().map(|movie| movie.id).collect::<Vec<_>>(), vec![2, 1]);
        assert!(movies.iter().all(|movie| movie.thumbnail_file.is_none()));
        let lookups: Vec<bool> = movies.iter().map(|movie| movie.poster_lookup).collect();
        assert_eq!(lookups, vec![true, false], "only a lost poster is looked up again");
    }

    #[test]
    fn missing_movies_are_never_pending() {
        let conn = open_in_memory();
        insert(&conn, 1, "A");
        conn.execute("UPDATE movies SET missing = 1", []).unwrap();
        assert!(pending_ids(&conn, true).is_empty());
    }

    #[test]
    fn gate_runs_one_worker_and_keeps_requests_made_during_a_pass() {
        let gate = PassGate::default();
        assert!(gate.request(), "idle: the caller starts a worker");
        assert!(!gate.request(), "running: no second worker");
        assert!(gate.next(), "the worker runs a pass");
        assert!(!gate.request(), "a request during the pass queues one more");
        assert!(gate.next());
        assert!(!gate.next(), "nothing left: the worker exits");
        assert!(gate.request(), "idle again: a new worker starts");
    }
}
