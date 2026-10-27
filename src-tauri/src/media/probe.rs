use std::io;
use std::path::Path;
use std::process::Command;

use serde::Deserialize;

/// What ffprobe reports about a video file.
#[derive(Debug, Default, Clone, PartialEq)]
pub struct Probe {
    pub quality: Option<String>,
    pub duration_seconds: Option<i64>,
}

#[derive(Deserialize)]
struct Output {
    #[serde(default)]
    streams: Vec<Stream>,
    format: Option<Format>,
}

#[derive(Deserialize)]
struct Stream {
    width: Option<u32>,
    height: Option<u32>,
    color_transfer: Option<String>,
}

#[derive(Deserialize)]
struct Format {
    duration: Option<String>,
}

/// Runs ffprobe on `file`. `Err` means ffprobe itself could not be run (e.g. not installed);
/// a file ffprobe cannot read gives an empty `Probe`, so it is not retried on every pass.
pub fn probe(file: &Path) -> io::Result<Probe> {
    let output = Command::new("ffprobe")
        .args(["-v", "error", "-select_streams", "v:0"])
        .args(["-show_entries", "stream=width,height,color_transfer:format=duration", "-of", "json"])
        .arg(file)
        .output()?;
    if !output.status.success() {
        return Ok(Probe::default());
    }
    Ok(parse(&output.stdout))
}

pub fn parse(json: &[u8]) -> Probe {
    let Ok(output) = serde_json::from_slice::<Output>(json) else {
        return Probe::default();
    };
    let quality = output.streams.first().and_then(|stream| {
        quality_label(stream.width?, stream.height?, stream.color_transfer.as_deref())
    });
    let duration_seconds = output
        .format
        .and_then(|format| format.duration?.parse::<f64>().ok())
        .filter(|seconds| seconds.is_finite() && *seconds > 0.0)
        .map(|seconds| seconds.round() as i64);
    Probe { quality, duration_seconds }
}

/// A short label such as "4K HDR" or "1080p". Width counts as much as height, so cropped
/// widescreen encodes (1920x800, 1882x1080) still read as 1080p.
pub fn quality_label(width: u32, height: u32, color_transfer: Option<&str>) -> Option<String> {
    let resolution = if width >= 3200 || height >= 2000 {
        "4K"
    } else if width >= 1800 || height >= 1000 {
        "1080p"
    } else if width >= 1200 || height >= 700 {
        "720p"
    } else if width > 0 && height > 0 {
        "SD"
    } else {
        return None;
    };
    let hdr = matches!(color_transfer, Some("smpte2084" | "arib-std-b67"));
    Some(if hdr { format!("{resolution} HDR") } else { resolution.to_string() })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn labels_by_resolution_and_hdr() {
        assert_eq!(quality_label(3840, 1600, Some("smpte2084")).as_deref(), Some("4K HDR"));
        assert_eq!(quality_label(3840, 2160, Some("bt709")).as_deref(), Some("4K"));
        assert_eq!(quality_label(1882, 1080, None).as_deref(), Some("1080p"));
        assert_eq!(quality_label(1920, 800, None).as_deref(), Some("1080p"));
        assert_eq!(quality_label(1280, 536, Some("arib-std-b67")).as_deref(), Some("720p HDR"));
        assert_eq!(quality_label(720, 480, None).as_deref(), Some("SD"));
        assert_eq!(quality_label(0, 0, None), None);
    }

    #[test]
    fn parses_ffprobe_json() {
        let json = br#"{"streams":[{"width":1882,"height":1080}],"format":{"duration":"5192.103583"}}"#;
        assert_eq!(parse(json), Probe { quality: Some("1080p".into()), duration_seconds: Some(5192) });
    }

    #[test]
    fn tolerates_missing_streams_and_bad_output() {
        assert_eq!(parse(br#"{"streams":[],"format":{"duration":"N/A"}}"#), Probe::default());
        assert_eq!(parse(b"not json"), Probe::default());
    }
}
