//! Video metadata (quality and duration from ffprobe) and thumbnails (OMDb posters, or an
//! ffmpeg frame when there is no poster), filled in by a background pass after each scan.
mod artwork;
mod enrich;
mod poster;
mod probe;

pub use artwork::poster_url;
pub use enrich::{forget_thumbnail, spawn, Enrichment, LIBRARY_UPDATED_EVENT};
