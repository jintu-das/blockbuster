use std::path::Path;
use std::sync::Mutex;
use std::time::SystemTime;

use rusqlite::Connection;
use tauri::ipc::Response;
use tauri::{AppHandle, Emitter, Manager};

use super::catalog::{self, MovieDetailsDto, MovieDto, ScanSummary};
use super::scanner;
use crate::{db, media};

const LIBRARY_FOLDER_KEY: &str = "library_folder";

/// The app's single SQLite connection, held in Tauri managed state.
pub struct Db(pub Mutex<Connection>);

/// Held for the whole of a scan (read folder setting, walk, apply) so two scans never
/// interleave and an older scan can never overwrite a newer one.
#[derive(Default)]
pub struct ScanLock(pub Mutex<()>);

fn to_message(error: impl std::fmt::Display) -> String {
    error.to_string()
}

/// Runs `work` on the blocking thread pool. Every command goes through this, so neither the
/// main thread nor async runtime workers ever wait on the database lock or the file system.
pub(crate) async fn blocking<T: Send + 'static>(
    app: AppHandle,
    work: impl FnOnce(&AppHandle) -> Result<T, String> + Send + 'static,
) -> Result<T, String> {
    tauri::async_runtime::spawn_blocking(move || work(&app)).await.map_err(to_message)?
}

pub(crate) fn with_conn<T>(app: &AppHandle, work: impl FnOnce(&mut Connection) -> rusqlite::Result<T>) -> Result<T, String> {
    let db = app.state::<Db>();
    let mut conn = db.0.lock().map_err(to_message)?;
    work(&mut conn).map_err(to_message)
}

/// Walks `folder` and applies the result in one transaction. With `save_folder`, the folder
/// setting is written in the same transaction, so it only changes if the scan succeeds.
/// A scan that finds nothing where the catalog has movies is refused (see
/// `catalog::looks_unmounted`). Afterwards a background pass fills in quality, duration and
/// thumbnails, and `library-updated` tells the UI if anything changed, whoever started the scan.
/// Callers must hold the `ScanLock`.
fn scan_into_catalog(app: &AppHandle, folder: &str, save_folder: bool) -> Result<ScanSummary, String> {
    let scan = scanner::scan_folder(Path::new(folder))?;
    let now = scanner::unix_seconds(SystemTime::now());
    let summary = with_conn(app, |conn| {
        if catalog::looks_unmounted(conn, &scan)? {
            return Ok(None);
        }
        let tx = conn.transaction()?;
        if save_folder {
            db::set_setting(&tx, LIBRARY_FOLDER_KEY, folder)?;
        }
        let summary = catalog::apply_scan(&tx, &scan, now)?;
        tx.commit()?;
        Ok(Some(summary))
    })?
    .ok_or(format!(
        "{folder} is empty, so the library was left as it was. If it is on a drive, check that the drive is mounted."
    ))?;
    media::spawn(app);
    if summary.added + summary.updated + summary.missing > 0 {
        let _ = app.emit(media::LIBRARY_UPDATED_EVENT, ());
    }
    Ok(summary)
}

/// Rescans the saved library folder, holding the `ScanLock` for the whole scan.
pub(crate) fn rescan_saved_folder(app: &AppHandle) -> Result<ScanSummary, String> {
    let lock = app.state::<ScanLock>();
    let _scanning = lock.0.lock().map_err(to_message)?;
    let folder = with_conn(app, |conn| db::get_setting(conn, LIBRARY_FOLDER_KEY))?.ok_or("Choose a library folder first.")?;
    scan_into_catalog(app, &folder, false)
}

#[tauri::command]
pub async fn get_library_folder(app: AppHandle) -> Result<Option<String>, String> {
    blocking(app, |app| with_conn(app, |conn| db::get_setting(conn, LIBRARY_FOLDER_KEY))).await
}

/// Scans `path` and, if that succeeds, makes it the library folder.
#[tauri::command]
pub async fn set_library_folder(app: AppHandle, path: String) -> Result<ScanSummary, String> {
    blocking(app, move |app| {
        let folder = Path::new(&path).canonicalize().map_err(|error| format!("Cannot open {path}: {error}"))?;
        let folder = folder.to_str().ok_or("The folder path contains unsupported characters.")?;
        let lock = app.state::<ScanLock>();
        let _scanning = lock.0.lock().map_err(to_message)?;
        scan_into_catalog(app, folder, true)
    })
    .await
}

#[tauri::command]
pub async fn scan_library(app: AppHandle) -> Result<ScanSummary, String> {
    blocking(app, rescan_saved_folder).await
}

#[tauri::command]
pub async fn list_movies(app: AppHandle) -> Result<Vec<MovieDto>, String> {
    blocking(app, |app| with_conn(app, |conn| catalog::list_movies(conn))).await
}

/// Stored OMDb and stream details for a movie on disk; `None` if it is not in the catalog.
#[tauri::command]
pub async fn get_movie_details(app: AppHandle, movie_id: i64) -> Result<Option<MovieDetailsDto>, String> {
    blocking(app, move |app| {
        let details = with_conn(app, |conn| catalog::movie_details(conn, movie_id))?;
        let omdb_enabled = app.state::<media::Enrichment>().has_omdb();
        Ok(details.map(|details| MovieDetailsDto { omdb_enabled, ..details }))
    })
    .await
}

/// The JPEG bytes of a movie's poster or frame. Looked up by movie, never by path, so the
/// webview can only read generated thumbnails. If the file has been deleted, the thumbnail is
/// forgotten and a metadata pass makes a new one.
#[tauri::command]
pub async fn get_thumbnail(app: AppHandle, movie_id: i64) -> Result<Response, String> {
    blocking(app, move |app| read_thumbnail(app, movie_id)).await
}

fn read_thumbnail(app: &AppHandle, movie_id: i64) -> Result<Response, String> {
    let file = with_conn(app, |conn| catalog::thumbnail_file(conn, movie_id))?
        .ok_or("This movie has no thumbnail yet.")?;
    let path = app.state::<media::Enrichment>().thumbnails_dir.join(file);
    match std::fs::read(path) {
        Ok(bytes) => Ok(Response::new(bytes)),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
            with_conn(app, |conn| media::forget_thumbnail(conn, movie_id))?;
            media::spawn(app);
            Err("The thumbnail is being made again.".into())
        }
        Err(error) => Err(to_message(error)),
    }
}

/// Artwork for full-width banners: the movie's OMDb poster at about 1500 px, downloaded the
/// first time it is asked for. Falls back to the thumbnail when the movie has no OMDb poster
/// (e.g. an ffmpeg frame) or the large one can't be fetched.
#[tauri::command]
pub async fn get_artwork(app: AppHandle, movie_id: i64) -> Result<Response, String> {
    blocking(app, move |app| {
        // The URL is read under the database lock; the download runs without it.
        let poster_url = with_conn(app, |conn| media::poster_url(conn, movie_id))?;
        let large = app.state::<media::Enrichment>().large_poster(movie_id, poster_url.as_deref());
        if let Some(bytes) = large.and_then(|path| std::fs::read(path).ok()) {
            return Ok(Response::new(bytes));
        }
        read_thumbnail(app, movie_id)
    })
    .await
}
