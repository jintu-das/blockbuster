use std::io;
use std::path::Path;
use std::process::Command;

use serde::{Deserialize, Serialize};

/// What ffprobe reports about a video file.
#[derive(Debug, Default, Clone, PartialEq)]
pub struct Probe {
    pub quality: Option<String>,
    pub duration_seconds: Option<i64>,
    /// `None` when ffprobe found no streams.
    pub media: Option<MediaInfo>,
}

/// Container and streams, stored as JSON for the details page.
#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MediaInfo {
    /// e.g. "Matroska".
    pub container: Option<String>,
    pub bitrate_kbps: Option<i64>,
    pub streams: Vec<MediaStream>,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MediaStream {
    /// "video", "audio" or "subtitle".
    pub kind: &'static str,
    /// ffprobe's codec name, e.g. "hevc", "truehd", "hdmv_pgs_subtitle".
    pub codec: String,
    pub profile: Option<String>,
    pub width: Option<u32>,
    pub height: Option<u32>,
    pub fps: Option<f64>,
    pub hdr: bool,
    /// The track players pick unless told otherwise.
    pub default: bool,
    pub channels: Option<u32>,
    pub channel_layout: Option<String>,
    pub sample_rate: Option<u32>,
    pub bitrate_kbps: Option<i64>,
    pub language: Option<String>,
    pub title: Option<String>,
}

#[derive(Deserialize)]
struct Output {
    #[serde(default)]
    streams: Vec<Stream>,
    format: Option<Format>,
}

#[derive(Deserialize)]
struct Stream {
    codec_type: Option<String>,
    codec_name: Option<String>,
    profile: Option<String>,
    width: Option<u32>,
    height: Option<u32>,
    avg_frame_rate: Option<String>,
    color_transfer: Option<String>,
    channels: Option<u32>,
    channel_layout: Option<String>,
    sample_rate: Option<String>,
    bit_rate: Option<String>,
    #[serde(default)]
    tags: Tags,
    #[serde(default)]
    disposition: Disposition,
}

#[derive(Default, Deserialize)]
struct Tags {
    language: Option<String>,
    title: Option<String>,
}

#[derive(Default, Deserialize)]
struct Disposition {
    /// 1 for cover art, which MKV and MP4 store as a video stream.
    #[serde(default)]
    attached_pic: u8,
    #[serde(default)]
    default: u8,
}

impl Stream {
    /// A real video track: MKV and MP4 cover art is also a video stream.
    fn is_video(&self) -> bool {
        self.codec_type.as_deref() == Some("video") && self.disposition.attached_pic == 0
    }
}

#[derive(Default, Deserialize)]
struct Format {
    duration: Option<String>,
    bit_rate: Option<String>,
    format_long_name: Option<String>,
}

/// Runs ffprobe on `file`. `Err` means ffprobe itself could not be run (e.g. not installed);
/// a file ffprobe cannot read gives an empty `Probe`, so it is not retried on every pass.
pub fn probe(file: &Path) -> io::Result<Probe> {
    let output = Command::new("ffprobe")
        .args(["-v", "error", "-of", "json", "-show_entries"])
        .arg(concat!(
            "stream=codec_type,codec_name,profile,width,height,avg_frame_rate,color_transfer,",
            "channels,channel_layout,sample_rate,bit_rate:stream_tags=language,title:",
            "stream_disposition=attached_pic,default:format=duration,bit_rate,format_long_name",
        ))
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
    let quality = output
        .streams
        .iter()
        .find(|stream| stream.is_video())
        .and_then(|video| quality_label(video.width?, video.height?, video.color_transfer.as_deref()));
    let streams: Vec<MediaStream> = output.streams.iter().filter_map(media_stream).collect();
    let format = output.format.unwrap_or_default();
    let duration_seconds = format
        .duration
        .and_then(|duration| duration.parse::<f64>().ok())
        .filter(|seconds| seconds.is_finite() && *seconds > 0.0)
        .map(|seconds| seconds.round() as i64);
    let media = (!streams.is_empty()).then(|| MediaInfo {
        // "Matroska / WebM" names the format family; the first name is the one people know.
        container: format.format_long_name.map(|name| name.split(" / ").next().unwrap_or(&name).to_string()),
        bitrate_kbps: kbps(format.bit_rate.as_deref()),
        streams,
    });
    Probe { quality, duration_seconds, media }
}

/// Video (not cover art), audio and subtitle streams; data and attachment streams are skipped.
fn media_stream(stream: &Stream) -> Option<MediaStream> {
    let kind = match stream.codec_type.as_deref()? {
        _ if stream.is_video() => "video",
        "audio" => "audio",
        "subtitle" => "subtitle",
        _ => return None,
    };
    Some(MediaStream {
        kind,
        codec: stream.codec_name.clone().unwrap_or_else(|| "unknown".into()),
        profile: stream.profile.clone(),
        width: stream.width,
        height: stream.height,
        fps: stream.avg_frame_rate.as_deref().and_then(frame_rate),
        hdr: is_hdr(stream.color_transfer.as_deref()),
        default: stream.disposition.default == 1,
        channels: stream.channels,
        channel_layout: stream.channel_layout.clone(),
        sample_rate: stream.sample_rate.as_deref().and_then(|rate| rate.parse().ok()),
        bitrate_kbps: kbps(stream.bit_rate.as_deref()),
        // "und" is ffprobe's "undetermined".
        language: stream.tags.language.clone().filter(|language| language != "und"),
        title: stream.tags.title.clone(),
    })
}

/// "24000/1001" to 23.976; "0/0" (unknown) to `None`.
fn frame_rate(rate: &str) -> Option<f64> {
    let (numerator, denominator) = rate.split_once('/')?;
    let (numerator, denominator) = (numerator.parse::<f64>().ok()?, denominator.parse::<f64>().ok()?);
    (numerator > 0.0 && denominator > 0.0).then(|| (numerator / denominator * 1000.0).round() / 1000.0)
}

fn kbps(bits_per_second: Option<&str>) -> Option<i64> {
    bits_per_second?.parse::<i64>().ok().filter(|bits| *bits > 0).map(|bits| (bits + 500) / 1000)
}

fn is_hdr(color_transfer: Option<&str>) -> bool {
    matches!(color_transfer, Some("smpte2084" | "arib-std-b67"))
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
    Some(if is_hdr(color_transfer) { format!("{resolution} HDR") } else { resolution.to_string() })
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
        let json = br#"{"streams":[{"codec_type":"video","width":1882,"height":1080}],"format":{"duration":"5192.103583"}}"#;
        let probe = parse(json);
        assert_eq!((probe.quality.as_deref(), probe.duration_seconds), (Some("1080p"), Some(5192)));
    }

    #[test]
    fn lists_streams_and_ignores_cover_art_for_quality() {
        let json = br#"{
            "streams": [
                {"codec_type":"video","codec_name":"mjpeg","width":600,"height":900,"disposition":{"attached_pic":1}},
                {"codec_type":"video","codec_name":"hevc","profile":"Main 10","width":3840,"height":1600,
                 "avg_frame_rate":"24000/1001","color_transfer":"smpte2084","disposition":{"attached_pic":0}},
                {"codec_type":"audio","codec_name":"truehd","channels":8,"channel_layout":"7.1",
                 "sample_rate":"48000","tags":{"language":"eng","title":"Atmos"},"disposition":{"default":1}},
                {"codec_type":"subtitle","codec_name":"hdmv_pgs_subtitle","tags":{"language":"und"}},
                {"codec_type":"attachment","codec_name":"ttf"}
            ],
            "format": {"duration":"9840.2","bit_rate":"54612345","format_long_name":"Matroska / WebM"}
        }"#;
        let probe = parse(json);
        assert_eq!(probe.quality.as_deref(), Some("4K HDR"));
        let media = probe.media.unwrap();
        assert_eq!((media.container.as_deref(), media.bitrate_kbps), (Some("Matroska"), Some(54612)));
        let kinds: Vec<_> = media.streams.iter().map(|stream| (stream.kind, stream.codec.as_str())).collect();
        assert_eq!(kinds, [("video", "hevc"), ("audio", "truehd"), ("subtitle", "hdmv_pgs_subtitle")]);
        assert_eq!(media.streams[0].fps, Some(23.976));
        assert!(media.streams[0].hdr);
        assert_eq!(media.streams[1].language.as_deref(), Some("eng"));
        assert!(media.streams[1].default && !media.streams[0].default);
        assert_eq!(media.streams[2].language, None, "\"und\" is no language");
    }

    #[test]
    fn tolerates_missing_streams_and_bad_output() {
        assert_eq!(parse(br#"{"streams":[],"format":{"duration":"N/A"}}"#), Probe::default());
        assert_eq!(parse(b"not json"), Probe::default());
    }
}
