use std::io::BufRead;
use std::os::unix::net::UnixStream;
use std::thread::{self, JoinHandle};
use std::time::{Duration, Instant, SystemTime};

use serde_json::json;
use tauri::{AppHandle, Emitter};

use super::mpv::{self, MpvEvent, MpvProcess};
use crate::library::catalog::{self, StoredProgress};
use crate::library::commands::with_conn;

const SAVE_INTERVAL: Duration = Duration::from_secs(10);
/// Watching past this fraction counts as finished.
const FINISHED_FRACTION: f64 = 0.95;
/// Stopping within this many seconds of the start is not worth resuming.
const MIN_RESUME_SECONDS: f64 = 10.0;
const STOP_TIMEOUT: Duration = Duration::from_secs(3);

/// The most recent state reported by mpv.
#[derive(Debug, Default, Clone, Copy, PartialEq)]
pub struct Playback {
    pub position: Option<f64>,
    pub duration: Option<f64>,
    pub ended_at_eof: bool,
}

/// Decides what to store as the resume position for a playback state.
pub fn progress_to_store(playback: &Playback) -> StoredProgress {
    if playback.ended_at_eof {
        return StoredProgress::Clear;
    }
    let Some(position) = playback.position else { return StoredProgress::Keep };
    let finished = playback.duration.is_some_and(|duration| duration > 0.0 && position / duration >= FINISHED_FRACTION);
    if finished || position < MIN_RESUME_SECONDS {
        StoredProgress::Clear
    } else {
        StoredProgress::Seconds(position as i64)
    }
}

/// Reads mpv events until the file ends or mpv goes away, calling `on_checkpoint` at most every
/// `SAVE_INTERVAL` while playing. Returns the final state.
pub fn watch(events: impl BufRead, mut on_checkpoint: impl FnMut(&Playback)) -> Playback {
    let mut playback = Playback::default();
    let mut last_checkpoint = Instant::now();

    for line in events.lines() {
        let Ok(line) = line else { break };
        match mpv::parse_event(&line) {
            Some(MpvEvent::TimePos(position)) => playback.position = Some(position),
            Some(MpvEvent::Duration(duration)) => playback.duration = Some(duration),
            Some(MpvEvent::EndFile { eof }) => {
                playback.ended_at_eof = eof;
                break;
            }
            None => continue,
        }
        if last_checkpoint.elapsed() >= SAVE_INTERVAL {
            on_checkpoint(&playback);
            last_checkpoint = Instant::now();
        }
    }
    playback
}

fn save(app: &AppHandle, movie_id: i64, playback: &Playback) {
    let now = crate::library::unix_seconds(SystemTime::now());
    let duration = playback.duration.map(|duration| duration.round() as i64);
    let result = with_conn(app, |conn| {
        catalog::save_playback(conn, movie_id, progress_to_store(playback), duration, now)
    });
    if let Err(error) = result {
        eprintln!("blockbuster: couldn't save playback for movie {movie_id}: {error}");
    }
}

/// A movie playing in mpv, tracked on its own thread.
pub struct ActiveSession {
    control: UnixStream,
    tracker: JoinHandle<()>,
}

impl ActiveSession {
    /// Asks mpv to quit and waits briefly for the tracker to save the final position.
    pub fn stop(mut self) {
        let _ = mpv::send(&mut self.control, json!(["quit"]));
        let deadline = Instant::now() + STOP_TIMEOUT;
        while !self.tracker.is_finished() && Instant::now() < deadline {
            thread::sleep(Duration::from_millis(25));
        }
        if self.tracker.is_finished() {
            let _ = self.tracker.join();
        }
    }
}

/// Starts tracking `process`. Progress is saved every `SAVE_INTERVAL` and when playback stops;
/// then `playback-ended` is emitted with `{ movieId }` so the UI can refresh.
pub fn start(app: AppHandle, movie_id: i64, process: MpvProcess) -> Result<ActiveSession, String> {
    let control = process.control.try_clone().map_err(|error| error.to_string())?;
    // Stamp `last_played_at` right away so the movie shows as recently played.
    save(&app, movie_id, &Playback::default());

    let tracker = thread::spawn(move || {
        let MpvProcess { mut child, events, socket_file: _socket_file, .. } = process;
        let playback = watch(events, |playback| save(&app, movie_id, playback));
        save(&app, movie_id, &playback);

        // mpv exits on its own after the file ends; reap it if it already has.
        for _ in 0..40 {
            if !matches!(child.try_wait(), Ok(None)) {
                break;
            }
            thread::sleep(Duration::from_millis(50));
        }
        let _ = app.emit("playback-ended", json!({ "movieId": movie_id }));
    });

    Ok(ActiveSession { control, tracker })
}

#[cfg(test)]
mod tests {
    use std::io::Cursor;

    use super::*;

    fn playback(position: Option<f64>, duration: Option<f64>, ended_at_eof: bool) -> Playback {
        Playback { position, duration, ended_at_eof }
    }

    #[test]
    fn progress_rules() {
        assert_eq!(progress_to_store(&playback(Some(1800.4), Some(7000.0), false)), StoredProgress::Seconds(1800));
        assert_eq!(progress_to_store(&playback(Some(6900.0), Some(7000.0), false)), StoredProgress::Clear);
        assert_eq!(progress_to_store(&playback(Some(1800.0), Some(7000.0), true)), StoredProgress::Clear);
        assert_eq!(progress_to_store(&playback(Some(4.0), Some(7000.0), false)), StoredProgress::Clear);
        assert_eq!(progress_to_store(&playback(None, Some(7000.0), false)), StoredProgress::Keep);
        assert_eq!(progress_to_store(&playback(Some(1800.0), None, false)), StoredProgress::Seconds(1800));
    }

    #[test]
    fn watch_keeps_last_position_through_end_of_file() {
        let lines = [
            r#"{"request_id":0,"error":"success"}"#,
            r#"{"event":"property-change","id":2,"name":"duration","data":20.008}"#,
            r#"{"event":"property-change","id":1,"name":"time-pos","data":19.96}"#,
            r#"{"event":"property-change","id":1,"name":"time-pos"}"#,
            r#"{"event":"end-file","reason":"eof","playlist_entry_id":1}"#,
        ]
        .join("\n");
        let result = watch(Cursor::new(lines), |_| {});
        assert_eq!(result, playback(Some(19.96), Some(20.008), true));
    }

    #[test]
    fn watch_ends_when_mpv_disappears() {
        let lines = r#"{"event":"property-change","id":1,"name":"time-pos","data":42.0}"#;
        assert_eq!(watch(Cursor::new(lines), |_| {}), playback(Some(42.0), None, false));
    }

    /// Runs real mpv headless on a generated clip. Needs `mpv` and `ffmpeg`:
    /// `cargo test -- --ignored`.
    #[test]
    #[ignore]
    fn real_mpv_reports_position_and_quits_cleanly() {
        let dir = tempfile::tempdir().unwrap();
        let clip = dir.path().join("clip.mkv");
        let status = std::process::Command::new("ffmpeg")
            .args(["-loglevel", "error", "-f", "lavfi", "-i", "testsrc=duration=20:size=160x120:rate=25"])
            .arg(&clip)
            .status()
            .expect("ffmpeg must be installed");
        assert!(status.success());

        let mpv::MpvProcess { mut child, mut control, events, socket_file: _socket_file } =
            mpv::launch(&clip, Some(5), "test", &["--vo=null", "--ao=null"]).unwrap();
        let quitter = thread::spawn(move || {
            thread::sleep(Duration::from_millis(1500));
            mpv::send(&mut control, json!(["quit"])).unwrap();
        });

        let result = watch(events, |_| {});
        quitter.join().unwrap();
        let _ = child.wait();

        let position = result.position.expect("mpv reported a position");
        assert!((5.0..8.0).contains(&position), "position {position}");
        assert!(result.duration.is_some_and(|duration| (19.0..21.0).contains(&duration)));
        assert!(!result.ended_at_eof);
        assert_eq!(progress_to_store(&result), StoredProgress::Clear, "under 10 s is not worth resuming");
    }
}
