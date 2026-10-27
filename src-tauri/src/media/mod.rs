//! Video metadata (quality and duration from ffprobe) and thumbnails (OMDb posters, or an
//! ffmpeg frame when there is no poster), filled in by a background pass after each scan.
mod enrich;
mod poster;
mod probe;

pub use enrich::{forget_thumbnail, spawn, Enrichment};
