use std::io::{self, BufReader, Write};
use std::os::unix::net::UnixStream;
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::thread;
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};

use serde_json::{json, Value};

const CONNECT_TIMEOUT: Duration = Duration::from_secs(5);

/// The parts of mpv's JSON IPC event stream that playback tracking needs.
#[derive(Debug, Clone, PartialEq)]
pub enum MpvEvent {
    TimePos(f64),
    Duration(f64),
    /// Playback of the file stopped; `eof` is true when it played to the end.
    EndFile { eof: bool },
}

/// Parses one line of mpv IPC output. Command replies, other events and property changes
/// without a value (mpv sends `time-pos` with no `data` when a file unloads) return `None`.
pub fn parse_event(line: &str) -> Option<MpvEvent> {
    let value: Value = serde_json::from_str(line).ok()?;
    match value.get("event")?.as_str()? {
        "property-change" => {
            let data = value.get("data")?.as_f64()?;
            match value.get("name")?.as_str()? {
                "time-pos" => Some(MpvEvent::TimePos(data)),
                "duration" => Some(MpvEvent::Duration(data)),
                _ => None,
            }
        }
        "end-file" => Some(MpvEvent::EndFile { eof: value.get("reason").and_then(Value::as_str) == Some("eof") }),
        _ => None,
    }
}

/// Removes the IPC socket file when dropped (mpv does not always clean it up).
pub struct SocketFile(PathBuf);

impl Drop for SocketFile {
    fn drop(&mut self) {
        let _ = std::fs::remove_file(&self.0);
    }
}

/// A running mpv with its IPC socket connected.
pub struct MpvProcess {
    pub child: Child,
    /// Write side, used to send commands such as `quit`.
    pub control: UnixStream,
    pub events: BufReader<UnixStream>,
    pub socket_file: SocketFile,
}

/// A short, unique socket path. Unix socket paths are limited to about 108 bytes, so this uses
/// `$XDG_RUNTIME_DIR` (e.g. `/run/user/1000`) rather than `TMPDIR`, which can be long.
fn socket_path() -> PathBuf {
    let dir = std::env::var_os("XDG_RUNTIME_DIR")
        .map(PathBuf::from)
        .filter(|dir| dir.is_dir())
        .unwrap_or_else(|| PathBuf::from("/tmp"));
    let nanos = SystemTime::now().duration_since(UNIX_EPOCH).map_or(0, |duration| duration.subsec_nanos());
    dir.join(format!("blockbuster-mpv-{}-{nanos}.sock", std::process::id()))
}

pub fn send(stream: &mut UnixStream, command: Value) -> io::Result<()> {
    let mut line = json!({ "command": command }).to_string();
    line.push('\n');
    stream.write_all(line.as_bytes())
}

/// Starts mpv on `file` and connects to its IPC socket, observing `time-pos` and `duration`.
///
/// The flags override user config that would break tracking: `keep-open`/`idle` would keep
/// mpv running after the movie ends, and mpv's own resume would fight Blockbuster's.
pub fn launch(file: &Path, start_seconds: Option<i64>, title: &str, extra_args: &[&str]) -> Result<MpvProcess, String> {
    let socket_path = socket_path();
    let mut command = Command::new("mpv");
    command
        .arg(format!("--input-ipc-server={}", socket_path.display()))
        .args(["--force-window=immediate", "--keep-open=no", "--idle=no"])
        .args(["--save-position-on-quit=no", "--resume-playback=no"])
        .arg(format!("--title={title}"))
        .args(extra_args)
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null());
    if let Some(seconds) = start_seconds {
        command.arg(format!("--start={seconds}"));
    }
    command.arg("--").arg(file);

    let mut child = command.spawn().map_err(|error| match error.kind() {
        io::ErrorKind::NotFound => "mpv is not installed. Install it with `sudo dnf install mpv`.".to_string(),
        _ => format!("Couldn't start mpv: {error}"),
    })?;

    let deadline = Instant::now() + CONNECT_TIMEOUT;
    let stream = loop {
        if let Ok(stream) = UnixStream::connect(&socket_path) {
            break stream;
        }
        if let Ok(Some(status)) = child.try_wait() {
            let _ = std::fs::remove_file(&socket_path);
            return Err(format!("mpv closed before playback started ({status})."));
        }
        if Instant::now() >= deadline {
            let _ = child.kill();
            let _ = child.wait();
            let _ = std::fs::remove_file(&socket_path);
            return Err("mpv did not respond in time.".to_string());
        }
        thread::sleep(Duration::from_millis(50));
    };

    let mut control = stream.try_clone().map_err(|error| error.to_string())?;
    let observe = send(&mut control, json!(["observe_property", 1, "time-pos"]))
        .and_then(|()| send(&mut control, json!(["observe_property", 2, "duration"])));
    if let Err(error) = observe {
        let _ = child.kill();
        return Err(format!("Couldn't talk to mpv: {error}"));
    }

    Ok(MpvProcess { child, control, events: BufReader::new(stream), socket_file: SocketFile(socket_path) })
}

#[cfg(test)]
mod tests {
    use super::*;

    // Lines captured from mpv 0.41.
    #[test]
    fn parses_real_mpv_lines() {
        assert_eq!(
            parse_event(r#"{"event":"property-change","id":1,"name":"time-pos","data":3.080000}"#),
            Some(MpvEvent::TimePos(3.08))
        );
        assert_eq!(
            parse_event(r#"{"event":"property-change","id":2,"name":"duration","data":20.008000}"#),
            Some(MpvEvent::Duration(20.008))
        );
        assert_eq!(
            parse_event(r#"{"event":"end-file","reason":"eof","playlist_entry_id":1}"#),
            Some(MpvEvent::EndFile { eof: true })
        );
        assert_eq!(
            parse_event(r#"{"event":"end-file","reason":"quit","playlist_entry_id":1}"#),
            Some(MpvEvent::EndFile { eof: false })
        );
    }

    #[test]
    fn ignores_replies_other_events_and_empty_values() {
        assert_eq!(parse_event(r#"{"request_id":0,"error":"success"}"#), None);
        assert_eq!(parse_event(r#"{"event":"video-reconfig"}"#), None);
        assert_eq!(parse_event(r#"{"event":"property-change","id":1,"name":"time-pos"}"#), None);
        assert_eq!(parse_event("not json"), None);
    }

    #[test]
    fn socket_path_fits_the_unix_limit() {
        assert!(socket_path().as_os_str().len() < 100);
    }
}
