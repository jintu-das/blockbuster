//! Movie playback in mpv, with position tracking over mpv's JSON IPC socket (Unix only).
pub mod commands;
mod mpv;
mod session;
