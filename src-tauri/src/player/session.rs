use std::io::BufRead;
use std::os::unix::net::UnixStream;
use std::path::{Path, PathBuf};
use std::thread::{self, JoinHandle};
use std::time::{Duration, Instant, SystemTime};

use serde_json::{json, Value};
use tauri::{AppHandle, Emitter};

use super::mpv::{self, MpvEvent, MpvProcess, Track};
use crate::library::catalog::{self, StoredProgress};
use crate::library::commands::with_conn;
use crate::subtitles::store::{Selection, SubtitlePlan};

const SAVE_INTERVAL: Duration = Duration::from_secs(10);
/// Watching past this fraction counts as finished.
const FINISHED_FRACTION: f64 = 0.95;
/// Stopping within this many seconds of the start is not worth resuming, nor counted as a play.
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
    if finished {
        StoredProgress::Clear
    } else if position < MIN_RESUME_SECONDS {
        StoredProgress::Skip
    } else {
        StoredProgress::Seconds(position as i64)
    }
}

/// The mpv id of the subtitle track loaded from `path`, once `track-list` shows it.
pub fn external_track(tracks: &[Track], path: &Path) -> Option<i64> {
    let path = path.to_string_lossy();
    tracks
        .iter()
        .find(|track| track.kind == "sub" && track.external_filename.as_deref() == Some(path.as_ref()))
        .map(|track| track.id)
}

/// Finishes setting subtitles up once mpv has loaded the file, from what `track-list` shows:
/// adds the added subtitles (selecting the chosen one, the rest unselected so Automatic keeps
/// mpv's pick) and selects an embedded or sidecar choice by its real track id. It only decides;
/// the session sends the commands.
pub struct SubtitleSetup {
    added: Vec<PathBuf>,
    select: Selection,
    loaded: bool,
}

impl SubtitleSetup {
    pub fn new(plan: SubtitlePlan) -> Self {
        SubtitleSetup { added: plan.added, select: plan.select, loaded: false }
    }

    /// The mpv commands to send for a new track list; none once everything is set up.
    pub fn on_tracks(&mut self, tracks: &[Track]) -> Vec<Value> {
        // Empty until the file has loaded.
        if tracks.is_empty() {
            return Vec::new();
        }
        let mut commands = Vec::new();
        if !self.loaded {
            self.loaded = true;
            for path in &self.added {
                let flag = if self.select == Selection::Added(path.clone()) { "select" } else { "auto" };
                commands.push(json!(["sub-add", path.to_string_lossy(), flag]));
            }
            if let Selection::Embedded(n) = self.select {
                // Embedded tracks are all listed at load; a video with fewer keeps mpv's pick.
                let embedded = tracks.iter().filter(|track| track.kind == "sub" && !track.external);
                if let Some(track) = embedded.clone().nth(n as usize - 1) {
                    commands.push(json!(["set_property", "sid", track.id]));
                }
            }
            if !matches!(self.select, Selection::Sidecar(_)) {
                self.select = Selection::Auto;
            }
        }
        if let Selection::Sidecar(path) = &self.select {
            if let Some(id) = external_track(tracks, path) {
                commands.push(json!(["set_property", "sid", id]));
                self.select = Selection::Auto;
            }
        }
        commands
    }
}

/// Reads mpv events until the file ends or mpv goes away, calling `on_checkpoint` at most every
/// `SAVE_INTERVAL` while playing and `on_tracks` when the track list changes. Returns the final
/// state.
pub fn watch(
    events: impl BufRead,
    mut on_checkpoint: impl FnMut(&Playback),
    mut on_tracks: impl FnMut(&[Track]),
) -> Playback {
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
            Some(MpvEvent::Tracks(tracks)) => {
                on_tracks(&tracks);
                continue;
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
/// then `playback-ended` is emitted with `{ movieId }` so the UI can refresh. An external
/// Subtitles are finished off by `SubtitleSetup` once mpv reports the file's tracks.
pub fn start(app: AppHandle, movie_id: i64, process: MpvProcess, subtitles: SubtitlePlan) -> Result<ActiveSession, String> {
    let control = process.control.try_clone().map_err(|error| error.to_string())?;
    // Stamp `last_played_at` right away so the movie shows as recently played.
    save(&app, movie_id, &Playback::default());

    let tracker = thread::spawn(move || {
        let MpvProcess { mut child, mut control, events, socket_file: _socket_file } = process;
        let mut subtitles = SubtitleSetup::new(subtitles);
        let playback = watch(
            events,
            |playback| save(&app, movie_id, playback),
            |tracks| {
                for command in subtitles.on_tracks(tracks) {
                    let _ = mpv::send(&mut control, command);
                }
            },
        );
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
        assert_eq!(progress_to_store(&playback(Some(4.0), Some(7000.0), false)), StoredProgress::Skip);
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
        let result = watch(Cursor::new(lines), |_| {}, |_| {});
        assert_eq!(result, playback(Some(19.96), Some(20.008), true));
    }

    fn track(id: i64, kind: &str, external_filename: Option<&str>) -> Track {
        Track { id, kind: kind.into(), external: external_filename.is_some(), external_filename: external_filename.map(Into::into) }
    }

    fn setup(added: &[&str], select: Selection) -> SubtitleSetup {
        SubtitleSetup::new(SubtitlePlan { sidecars: Vec::new(), added: added.iter().map(PathBuf::from).collect(), select })
    }

    #[test]
    fn watch_reports_track_lists() {
        let lines = r#"{"event":"property-change","id":3,"name":"track-list","data":[{"id":2,"type":"sub","external":true,"external-filename":"/m/A.srt"}]}"#;
        let mut seen = Vec::new();
        watch(Cursor::new(lines), |_| {}, |tracks| seen = tracks.to_vec());
        assert_eq!(seen, vec![track(2, "sub", Some("/m/A.srt"))]);
    }

    #[test]
    fn setup_waits_for_the_file_then_adds_and_selects_once() {
        let loaded = [track(1, "video", None), track(1, "sub", None), track(2, "sub", None)];
        let mut chosen = setup(&["/d/1.srt", "/d/2.srt"], Selection::Added("/d/2.srt".into()));
        assert!(chosen.on_tracks(&[]).is_empty(), "nothing before the file loads");
        assert_eq!(
            chosen.on_tracks(&loaded),
            vec![json!(["sub-add", "/d/1.srt", "auto"]), json!(["sub-add", "/d/2.srt", "select"])]
        );
        assert!(chosen.on_tracks(&loaded).is_empty(), "only once");

        assert_eq!(setup(&[], Selection::Embedded(2)).on_tracks(&loaded), vec![json!(["set_property", "sid", 2])]);
        assert!(setup(&[], Selection::Embedded(3)).on_tracks(&loaded).is_empty(), "too few embedded: mpv picks");
        assert!(setup(&[], Selection::Auto).on_tracks(&loaded).is_empty());
    }

    #[test]
    fn setup_selects_embedded_by_position_among_embedded_only() {
        // An external track listed between embedded ones must not shift the count.
        let tracks = [track(1, "sub", None), track(2, "sub", Some("/m/A.srt")), track(3, "sub", None)];
        assert_eq!(setup(&[], Selection::Embedded(2)).on_tracks(&tracks), vec![json!(["set_property", "sid", 3])]);
    }

    #[test]
    fn setup_selects_a_sidecar_once_it_is_listed() {
        let mut sidecar = setup(&[], Selection::Sidecar("/m/A.en.srt".into()));
        assert!(sidecar.on_tracks(&[track(1, "sub", None)]).is_empty(), "not loaded yet");
        let tracks = [track(1, "sub", None), track(2, "sub", Some("/m/A.en.srt"))];
        assert_eq!(sidecar.on_tracks(&tracks), vec![json!(["set_property", "sid", 2])]);
        assert!(sidecar.on_tracks(&tracks).is_empty());
    }

    #[test]
    fn watch_ends_when_mpv_disappears() {
        let lines = r#"{"event":"property-change","id":1,"name":"time-pos","data":42.0}"#;
        assert_eq!(watch(Cursor::new(lines), |_| {}, |_| {}), playback(Some(42.0), None, false));
    }

    /// Plays a clip with an embedded subtitle, a sidecar next to it and an added subtitle that is
    /// chosen. Checks the sidecar is loaded once (mpv's own sidecar loading skips files already
    /// given with `--sub-file`) and mpv ends up on the added one. Needs `mpv` and `ffmpeg`:
    /// `cargo test -- --ignored`.
    #[test]
    #[ignore]
    fn real_mpv_loads_sidecars_once_and_selects_the_chosen_subtitle() {
        let dir = tempfile::tempdir().unwrap();
        let added_dir = tempfile::tempdir().unwrap();
        let cue = |text: &str| format!("1\n00:00:00,000 --> 00:00:09,000\n{text}\n");
        let embedded = added_dir.path().join("embedded.srt");
        let sidecar = dir.path().join("clip.en.srt");
        let added = added_dir.path().join("1.srt");
        std::fs::write(&embedded, cue("embedded")).unwrap();
        std::fs::write(&sidecar, cue("sidecar")).unwrap();
        std::fs::write(&added, cue("added")).unwrap();
        let clip = dir.path().join("clip.mkv");
        let status = std::process::Command::new("ffmpeg")
            .args(["-loglevel", "error", "-f", "lavfi", "-i", "testsrc=duration=10:size=160x120:rate=25", "-i"])
            .arg(&embedded)
            .args(["-c:s", "srt"])
            .arg(&clip)
            .status()
            .expect("ffmpeg must be installed");
        assert!(status.success());

        let plan = SubtitlePlan {
            sidecars: vec![sidecar.clone()],
            added: vec![added.clone()],
            select: Selection::Added(added.clone()),
        };
        let mut subtitles = SubtitleSetup::new(plan.clone());
        let mpv::MpvProcess { mut child, mut control, events, socket_file: _socket_file } =
            mpv::launch(&clip, None, "test", &plan, &["--vo=null", "--ao=null", "--sub-auto=exact"]).unwrap();

        let mut quitter = control.try_clone().unwrap();
        let mut done = None;
        let deadline = Instant::now() + Duration::from_secs(5);
        for line in events.lines() {
            let line = line.unwrap();
            if let Some(MpvEvent::Tracks(tracks)) = mpv::parse_event(&line) {
                for command in subtitles.on_tracks(&tracks) {
                    mpv::send(&mut control, command).unwrap();
                }
            }
            let value: Value = serde_json::from_str(&line).unwrap_or_default();
            if value["name"] == "track-list" {
                let subs: Vec<&Value> = value["data"].as_array().into_iter().flatten().filter(|track| track["type"] == "sub").collect();
                let selected = subs.iter().find(|track| track["selected"] == true).and_then(|track| track["external-filename"].as_str());
                if selected == added.to_str() {
                    done = Some(subs.len());
                    break;
                }
            }
            if Instant::now() > deadline {
                break;
            }
        }
        mpv::send(&mut quitter, json!(["quit"])).unwrap();
        let _ = child.wait();
        assert_eq!(done, Some(3), "embedded, sidecar once, added; added selected");
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
            mpv::launch(&clip, Some(5), "test", &Default::default(), &["--vo=null", "--ao=null"]).unwrap();
        let quitter = thread::spawn(move || {
            thread::sleep(Duration::from_millis(1500));
            mpv::send(&mut control, json!(["quit"])).unwrap();
        });

        let result = watch(events, |_| {}, |_| {});
        quitter.join().unwrap();
        let _ = child.wait();

        let position = result.position.expect("mpv reported a position");
        assert!((5.0..8.0).contains(&position), "position {position}");
        assert!(result.duration.is_some_and(|duration| (19.0..21.0).contains(&duration)));
        assert!(!result.ended_at_eof);
        assert_eq!(progress_to_store(&result), StoredProgress::Skip, "under 10 s is not a play");
    }
}
