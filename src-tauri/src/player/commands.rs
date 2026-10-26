use std::path::Path;
use std::sync::Mutex;

use tauri::{AppHandle, Manager};

use super::{mpv, session};
use crate::library::catalog;
use crate::library::commands::{blocking, with_conn};

/// The movie currently playing, if any. Only one plays at a time.
#[derive(Default)]
pub struct Player(pub Mutex<Option<session::ActiveSession>>);

/// Plays a movie in mpv, resuming from its saved position unless `from_start` is set.
/// A movie that is already playing is stopped first, after its position is saved.
#[tauri::command]
pub async fn play_movie(app: AppHandle, movie_id: i64, from_start: bool) -> Result<(), String> {
    blocking(app, move |app| {
        let target = with_conn(app, |conn| catalog::movie_for_playback(conn, movie_id))?
            .ok_or("This movie is no longer in your library.")?;
        if !Path::new(&target.path).is_file() {
            return Err("This file is no longer on disk. Scan the library to refresh.".to_string());
        }

        let player = app.state::<Player>();
        let mut active = player.0.lock().map_err(|error| error.to_string())?;
        if let Some(previous) = active.take() {
            previous.stop();
        }

        let start = if from_start { None } else { target.progress_seconds };
        let process = mpv::launch(Path::new(&target.path), start, &target.title, &[])?;
        *active = Some(session::start(app.clone(), movie_id, process)?);
        Ok(())
    })
    .await
}

/// Called when the app exits: stops mpv so the final position is saved.
pub fn shutdown(app: &AppHandle) {
    let player = app.state::<Player>();
    let session = player.0.lock().ok().and_then(|mut active| active.take());
    if let Some(session) = session {
        session.stop();
    }
}
