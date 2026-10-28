use std::fs;
use std::path::Path;
use std::time::SystemTime;

use serde::Serialize;
use tauri::{AppHandle, Manager};

use super::opensubtitles::{self, SearchQuery, SubtitleResult};
use super::sidecar::{self, Sidecar};
use super::store::{self, AddedSubtitle, Choice, NewSubtitle};
use super::{Subtitles, MAX_SUBTITLE_BYTES};
use crate::library::catalog;
use crate::library::commands::{blocking, with_conn};
use crate::library::unix_seconds;

const NOT_IN_LIBRARY: &str = "This movie is no longer in your library.";
const OPENSUBTITLES: &str = "opensubtitles";

/// The subtitles of a movie besides its embedded streams (those come with `get_movie_details`).
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SubtitlesDto {
    sidecars: Vec<Sidecar>,
    added: Vec<AddedSubtitle>,
    /// The remembered choice as stored (see `store::Choice`); `None` lets mpv decide.
    choice: Option<String>,
    /// Whether OpenSubtitles search is available (an API key is set).
    search_enabled: bool,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DownloadedSubtitle {
    subtitle: AddedSubtitle,
    /// OpenSubtitles downloads left today; `None` when nothing was downloaded.
    remaining: Option<i64>,
    /// The file had been downloaded before, so no quota was used.
    already_added: bool,
}

fn video_path(app: &AppHandle, movie_id: i64) -> Result<String, String> {
    with_conn(app, |conn| catalog::movie_for_playback(conn, movie_id))?
        .map(|target| target.path)
        .ok_or_else(|| NOT_IN_LIBRARY.to_string())
}

/// Saves `bytes` as a new added subtitle. The row is inserted first so the file gets its id
/// as its name; if the file can't be written, the row is removed again.
fn store_subtitle(app: &AppHandle, new: &NewSubtitle, bytes: &[u8]) -> Result<AddedSubtitle, String> {
    let dir = app.state::<Subtitles>().dir.clone();
    let subtitle = with_conn(app, |conn| store::insert_added(conn, new))?;
    let dest = dir.join(&subtitle.file);
    let partial = dest.with_extension("part");
    let written = fs::create_dir_all(&dir)
        .and_then(|()| fs::write(&partial, bytes))
        .and_then(|()| fs::rename(&partial, &dest));
    if let Err(error) = written {
        let _ = fs::remove_file(&partial);
        with_conn(app, |conn| store::remove_added(conn, subtitle.id))?;
        return Err(format!("Couldn't save the subtitle: {error}"));
    }
    Ok(subtitle)
}

#[tauri::command]
pub async fn list_subtitles(app: AppHandle, movie_id: i64) -> Result<SubtitlesDto, String> {
    blocking(app, move |app| {
        let path = video_path(app, movie_id)?;
        let (added, choice) =
            with_conn(app, |conn| Ok((store::list_added(conn, movie_id)?, store::choice(conn, movie_id)?)))?;
        Ok(SubtitlesDto {
            sidecars: sidecar::find_sidecars(Path::new(&path)),
            added,
            choice: choice.map(|choice| choice.to_text()),
            search_enabled: app.state::<Subtitles>().opensubtitles.is_some(),
        })
    })
    .await
}

/// Remembers the subtitle mpv starts with; `None` lets mpv decide.
#[tauri::command]
pub async fn set_subtitle_choice(app: AppHandle, movie_id: i64, choice: Option<String>) -> Result<(), String> {
    blocking(app, move |app| {
        let choice = choice
            .map(|text| Choice::parse(&text).ok_or_else(|| format!("Unknown subtitle choice: {text}")))
            .transpose()?;
        with_conn(app, |conn| store::set_choice(conn, movie_id, choice.as_ref()))
    })
    .await
}

/// Copies a subtitle file the user picked into the app data folder.
#[tauri::command]
pub async fn add_subtitle_file(app: AppHandle, movie_id: i64, path: String) -> Result<AddedSubtitle, String> {
    blocking(app, move |app| {
        video_path(app, movie_id)?;
        let source = Path::new(&path);
        let file_name = source.file_name().and_then(|name| name.to_str()).ok_or("That file name can't be read.")?;
        let format = sidecar::subtitle_format(file_name).ok_or_else(|| {
            format!("{file_name} isn't a subtitle file. Choose an .srt, .ass, .ssa, .vtt or .sub file.")
        })?;
        let size = fs::metadata(source).map_err(|error| format!("Couldn't read {file_name}: {error}"))?.len();
        if size > MAX_SUBTITLE_BYTES {
            return Err(format!("{file_name} is over 5 MB, too big for a subtitle file."));
        }
        let bytes = fs::read(source).map_err(|error| format!("Couldn't read {file_name}: {error}"))?;
        let language = sidecar::guess_language(file_name);
        let new = NewSubtitle {
            movie_id,
            label: file_name,
            language: language.as_deref(),
            source: "file",
            source_id: None,
            format: &format,
            now: unix_seconds(SystemTime::now()),
        };
        store_subtitle(app, &new, &bytes)
    })
    .await
}

/// Deletes an added subtitle and its copy. Embedded and sidecar subtitles can't be removed.
#[tauri::command]
pub async fn remove_subtitle(app: AppHandle, subtitle_id: i64) -> Result<(), String> {
    blocking(app, move |app| {
        let Some(file) = with_conn(app, |conn| store::remove_added(conn, subtitle_id))? else { return Ok(()) };
        match fs::remove_file(app.state::<Subtitles>().dir.join(file)) {
            Err(error) if error.kind() != std::io::ErrorKind::NotFound => {
                eprintln!("blockbuster: couldn't delete subtitle {subtitle_id}: {error}");
            }
            _ => {}
        }
        Ok(())
    })
    .await
}

/// Searches OpenSubtitles by IMDb id when OMDb found one, else by title and year. Files made
/// for this exact video (matching movie hash) come first.
#[tauri::command]
pub async fn search_subtitles(app: AppHandle, movie_id: i64, languages: Vec<String>) -> Result<Vec<SubtitleResult>, String> {
    blocking(app, move |app| {
        let state = app.state::<Subtitles>();
        let client = state.opensubtitles.as_ref().ok_or("Set OPENSUBTITLES_API_KEY to search OpenSubtitles.")?;
        let hints = with_conn(app, |conn| store::search_hints(conn, movie_id))?.ok_or(NOT_IN_LIBRARY)?;
        // The hash is a bonus: an unreadable file still gets results by title.
        let moviehash = opensubtitles::moviehash(Path::new(&hints.path)).ok().flatten();
        client.search(&SearchQuery {
            imdb_id: hints.imdb_id.as_deref().and_then(opensubtitles::imdb_number),
            title: &hints.title,
            year: hints.year,
            languages: &languages,
            moviehash,
        })
    })
    .await
}

/// Downloads a search result and stores it like an added file. A file downloaded before for
/// this movie is returned as is, without using the daily quota again.
#[tauri::command]
pub async fn download_subtitle(
    app: AppHandle,
    movie_id: i64,
    file_id: i64,
    release: String,
    language: Option<String>,
) -> Result<DownloadedSubtitle, String> {
    blocking(app, move |app| {
        video_path(app, movie_id)?;
        let state = app.state::<Subtitles>();
        let _downloading = state.downloads.lock().map_err(|error| error.to_string())?;
        let source_id = file_id.to_string();
        if let Some(subtitle) = with_conn(app, |conn| store::find_by_source(conn, movie_id, OPENSUBTITLES, &source_id))? {
            return Ok(DownloadedSubtitle { subtitle, remaining: None, already_added: true });
        }

        let client = state.opensubtitles.as_ref().ok_or("Set OPENSUBTITLES_API_KEY to download subtitles.")?;
        let download = client.download(file_id)?;
        let format = download.file_name.as_deref().and_then(sidecar::subtitle_format).unwrap_or_else(|| "srt".to_string());
        let new = NewSubtitle {
            movie_id,
            label: &release,
            language: language.as_deref(),
            source: OPENSUBTITLES,
            source_id: Some(&source_id),
            format: &format,
            now: unix_seconds(SystemTime::now()),
        };
        let subtitle = store_subtitle(app, &new, &download.bytes)?;
        Ok(DownloadedSubtitle { subtitle, remaining: download.remaining, already_added: false })
    })
    .await
}
