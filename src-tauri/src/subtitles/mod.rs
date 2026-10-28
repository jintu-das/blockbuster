//! Subtitles for a movie: streams embedded in the video (listed from ffprobe's `media_json`),
//! sidecar files next to it (read live, never written), and files the user added from disk or
//! OpenSubtitles (copied to `<app data>/subtitles/`). The subtitle chosen for a movie is applied
//! when mpv starts.
pub mod commands;
mod opensubtitles;
mod sidecar;
pub(crate) mod store;

use std::path::PathBuf;
use std::sync::Mutex;

use opensubtitles::OpenSubtitles;
pub use sidecar::find_sidecars;

/// Formats mpv reads that people actually use as files.
pub const SUBTITLE_EXTENSIONS: &[&str] = &["srt", "ass", "ssa", "vtt", "sub"];
/// Real subtitle files are well under this; anything bigger is the wrong file.
pub const MAX_SUBTITLE_BYTES: u64 = 5 * 1024 * 1024;

/// Subtitle state, held in Tauri managed state.
pub struct Subtitles {
    /// Where added subtitles are stored.
    pub dir: PathBuf,
    /// Online search, when `OPENSUBTITLES_API_KEY` is set.
    opensubtitles: Option<OpenSubtitles>,
    /// Held for a whole download (check, fetch, store), so two clicks on the same result can't
    /// both spend the daily quota or store it twice.
    downloads: Mutex<()>,
}

impl Subtitles {
    pub fn new(dir: PathBuf, opensubtitles_api_key: Option<String>) -> Self {
        let opensubtitles = opensubtitles_api_key.filter(|key| !key.is_empty()).map(OpenSubtitles::new);
        Subtitles { dir, opensubtitles, downloads: Mutex::new(()) }
    }
}
