use std::fs;
use std::io;
use std::path::Path;
use std::process::Command;
use std::time::Duration;

use serde::Deserialize;

const OMDB_URL: &str = "https://www.omdbapi.com/";
const HTTP_TIMEOUT: Duration = Duration::from_secs(15);

/// A movie OMDb identified: its reply verbatim (kept for the details page) and its poster.
#[derive(Debug, PartialEq)]
pub struct OmdbMatch {
    pub json: String,
    pub poster_url: Option<String>,
}

/// The fields of an OMDb lookup reply that matching needs. Fields are capitalized and "N/A"
/// means absent.
#[derive(Debug, Deserialize)]
#[serde(rename_all = "PascalCase")]
struct OmdbReply {
    response: String,
    year: Option<String>,
    poster: Option<String>,
    error: Option<String>,
}

/// OMDb's reply to a title search.
#[derive(Debug, Deserialize)]
#[serde(rename_all = "PascalCase")]
struct SearchReply {
    response: String,
    #[serde(default)]
    search: Vec<SearchHit>,
    error: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "PascalCase")]
struct SearchHit {
    title: String,
    #[serde(rename = "imdbID")]
    imdb_id: String,
}

pub struct Omdb {
    agent: ureq::Agent,
    api_key: String,
}

impl Omdb {
    pub fn new(api_key: String) -> Self {
        let agent = ureq::Agent::config_builder().timeout_global(Some(HTTP_TIMEOUT)).build().into();
        Omdb { agent, api_key }
    }

    /// The OMDb entry for a movie. `Ok(None)` is a definite "not found"; `Err` is a network,
    /// key or rate-limit problem worth retrying later.
    ///
    /// With a year, the title and year are looked up; on a miss the title is tried alone and
    /// accepted only if OMDb's year is within one of ours. Without a year, a title alone is
    /// ambiguous (remakes), so a movie is only taken when exactly one search result has the
    /// same title. Search results lack plot and credits, so that one is then looked up by id.
    pub fn find(&self, title: &str, year: Option<i32>) -> Result<Option<OmdbMatch>, String> {
        if normalize(title).is_empty() {
            return Ok(None);
        }
        let Some(year) = year else {
            let hits = self.search(title)?;
            return match unique_hit(title, &hits) {
                Some(hit) => Ok(self.lookup(&[("i", &hit.imdb_id)])?.map(to_match)),
                None => Ok(None),
            };
        };
        if let Some(found) = self.lookup(&[("t", title), ("y", &year.to_string())])? {
            return Ok(Some(to_match(found)));
        }
        let Some(found) = self.lookup(&[("t", title)])? else {
            return Ok(None);
        };
        match found.0.year.as_deref().and_then(first_year) {
            Some(theirs) if (year - theirs).abs() > 1 => Ok(None),
            _ => Ok(Some(to_match(found))),
        }
    }

    /// A lookup by title (`t`, optionally `y`) or IMDb id (`i`), with the reply's raw text.
    fn lookup(&self, params: &[(&str, &str)]) -> Result<Option<(OmdbReply, String)>, String> {
        let mut request = self.request().query("plot", "full");
        for (key, value) in params {
            request = request.query(*key, *value);
        }
        let json = request
            .call()
            .and_then(|mut response| response.body_mut().read_to_string())
            .map_err(|error| format!("OMDb: {error}"))?;
        let reply: OmdbReply = serde_json::from_str(&json).map_err(|error| format!("OMDb: {error}"))?;
        Ok(answered(&reply.response, reply.error.as_deref())?.then_some((reply, json)))
    }

    fn search(&self, title: &str) -> Result<Vec<SearchHit>, String> {
        let reply: SearchReply = self
            .request()
            .query("s", title)
            .call()
            .and_then(|mut response| response.body_mut().read_json())
            .map_err(|error| format!("OMDb: {error}"))?;
        Ok(if answered(&reply.response, reply.error.as_deref())? { reply.search } else { Vec::new() })
    }

    fn request(&self) -> ureq::RequestBuilder<ureq::typestate::WithoutBody> {
        self.agent.get(OMDB_URL).query("apikey", &self.api_key).query("type", "movie")
    }

    /// Saves the image at `url` to `dest`, writing a temporary file first so a failed download
    /// never leaves a partial image behind. `Ok(false)` means the image is gone for good (an
    /// HTTP 4xx, e.g. a stale link); `Err` is a network problem worth retrying.
    pub fn download(&self, url: &str, dest: &Path) -> Result<bool, String> {
        match self.agent.get(url).call() {
            Ok(mut response) => {
                let bytes = response.body_mut().read_to_vec().map_err(|error| format!("poster download: {error}"))?;
                write_atomically(dest, &bytes).map_err(|error| error.to_string())?;
                Ok(true)
            }
            Err(ureq::Error::StatusCode(status)) if (400..500).contains(&status) => Ok(false),
            Err(error) => Err(format!("poster download: {error}")),
        }
    }
}

/// Whether OMDb found something. Only key and rate-limit errors are `Err`: they affect every
/// lookup, so the caller stops for this pass. Any other error ("Movie not found!",
/// "Too many results.", "Incorrect IMDb ID.") is about this title alone and counts as a miss.
fn answered(response: &str, error: Option<&str>) -> Result<bool, String> {
    if response == "True" {
        return Ok(true);
    }
    match error {
        Some(error) if error.contains("API key") || error.contains("limit") => Err(format!("OMDb: {error}")),
        _ => Ok(false),
    }
}

fn poster_of(poster: Option<String>) -> Option<String> {
    poster.filter(|url| url.starts_with("http"))
}

fn to_match((reply, json): (OmdbReply, String)) -> OmdbMatch {
    OmdbMatch { poster_url: poster_of(reply.poster), json }
}

fn unique_hit<'a>(title: &str, hits: &'a [SearchHit]) -> Option<&'a SearchHit> {
    let wanted = normalize(title);
    let mut same_title = hits.iter().filter(|hit| normalize(&hit.title) == wanted);
    match (same_title.next(), same_title.next()) {
        (Some(hit), None) => Some(hit),
        _ => None,
    }
}

/// Lowercase letters and digits only, so "Whats Eating" matches "What's Eating".
fn normalize(title: &str) -> String {
    title.chars().filter(|c| c.is_alphanumeric()).flat_map(char::to_lowercase).collect()
}

/// OMDb years can be ranges like "2019–2021".
fn first_year(year: &str) -> Option<i32> {
    year.get(..4)?.parse().ok()
}

fn write_atomically(dest: &Path, bytes: &[u8]) -> io::Result<()> {
    let partial = dest.with_extension("part");
    fs::write(&partial, bytes)?;
    fs::rename(&partial, dest)
}

/// Grabs one frame at `at_seconds` into `dest` with ffmpeg, scaled to 480 px wide.
/// `Err` means ffmpeg could not be run; `Ok(false)` means it produced no image.
pub fn extract_frame(video: &Path, at_seconds: i64, dest: &Path) -> io::Result<bool> {
    let partial = dest.with_extension("part.jpg");
    let status = Command::new("ffmpeg")
        .args(["-loglevel", "error", "-y", "-ss", &at_seconds.to_string(), "-i"])
        .arg(video)
        .args(["-frames:v", "1", "-vf", "scale=480:-2", "-q:v", "3"])
        .arg(&partial)
        .status()?;
    if status.success() && partial.metadata().is_ok_and(|meta| meta.len() > 0) {
        fs::rename(&partial, dest)?;
        Ok(true)
    } else {
        let _ = fs::remove_file(&partial);
        Ok(false)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn hit(title: &str, imdb_id: &str) -> SearchHit {
        SearchHit { title: title.into(), imdb_id: imdb_id.into() }
    }

    #[test]
    fn keeps_the_reply_verbatim_and_reads_its_poster() {
        let json = r#"{"Title":"Ran","Year":"1985","Plot":"An aging lord...","Poster":"https://m.media-amazon.com/x.jpg","Response":"True"}"#;
        let reply: OmdbReply = serde_json::from_str(json).unwrap();
        let found = to_match((reply, json.to_string()));
        assert_eq!(found.json, json);
        assert_eq!(found.poster_url.as_deref(), Some("https://m.media-amazon.com/x.jpg"));
        assert_eq!(poster_of(Some("N/A".into())), None);
    }

    #[test]
    fn only_key_and_limit_errors_stop_lookups() {
        assert_eq!(answered("True", None), Ok(true));
        assert_eq!(answered("False", Some("Movie not found!")), Ok(false));
        assert_eq!(answered("False", Some("Too many results.")), Ok(false));
        assert_eq!(answered("False", Some("Incorrect IMDb ID.")), Ok(false));
        assert!(answered("False", Some("Invalid API key!")).is_err());
        assert!(answered("False", Some("Request limit reached!")).is_err());
    }

    #[test]
    fn year_less_titles_need_one_unambiguous_match() {
        let hits = [hit("Dune", "tt0087182"), hit("Dune", "tt1160419"), hit("Dune: Part Two", "tt15239678")];
        assert!(unique_hit("Dune", &hits).is_none());

        let hits = [hit("What's Eating Gilbert Grape", "tt0108550"), hit("Grape", "tt0000001")];
        assert_eq!(unique_hit("Whats Eating Gilbert Grape", &hits).map(|hit| hit.imdb_id.as_str()), Some("tt0108550"));
        assert!(unique_hit("Absentia", &hits).is_none());
    }

    #[test]
    fn search_replies_parse_with_and_without_results() {
        let found: SearchReply =
            serde_json::from_str(r#"{"Search":[{"Title":"Tess","Year":"1979","imdbID":"tt0080009","Poster":"N/A"}],"Response":"True"}"#)
                .unwrap();
        assert_eq!(found.search[0].imdb_id, "tt0080009");
        let missed: SearchReply = serde_json::from_str(r#"{"Response":"False","Error":"Movie not found!"}"#).unwrap();
        assert!(missed.search.is_empty());
    }

    #[test]
    fn year_ranges_use_the_first_year() {
        assert_eq!(first_year("2019–2021"), Some(2019));
        assert_eq!(first_year("N/A"), None);
    }

    /// Generates a clip and grabs a frame from it. Needs `ffmpeg`: `cargo test -- --ignored`.
    #[test]
    #[ignore]
    fn real_ffmpeg_extracts_a_frame() {
        let dir = tempfile::tempdir().unwrap();
        let clip = dir.path().join("clip.mkv");
        let status = Command::new("ffmpeg")
            .args(["-loglevel", "error", "-f", "lavfi", "-i", "testsrc=duration=5:size=640x360:rate=25"])
            .arg(&clip)
            .status()
            .expect("ffmpeg must be installed");
        assert!(status.success());

        let frame = dir.path().join("frame.jpg");
        assert!(extract_frame(&clip, 2, &frame).unwrap());
        assert!(frame.metadata().unwrap().len() > 0);
        assert!(!extract_frame(&clip, 60, &dir.path().join("past-end.jpg")).unwrap());

        let probe = super::super::probe::probe(&clip).unwrap();
        assert_eq!((probe.quality.as_deref(), probe.duration_seconds), (Some("SD"), Some(5)));
        let media = probe.media.expect("ffprobe lists the clip's streams");
        assert_eq!(media.container.as_deref(), Some("Matroska"));
        assert_eq!(media.streams.iter().map(|stream| stream.kind).collect::<Vec<_>>(), ["video"]);
        assert_eq!(media.streams[0].fps, Some(25.0));
    }
}
