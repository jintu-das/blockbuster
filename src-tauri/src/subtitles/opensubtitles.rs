use std::fs::File;
use std::io::{self, Read, Seek, SeekFrom};
use std::path::Path;
use std::time::Duration;

use serde::{Deserialize, Serialize};
use serde_json::json;

use super::MAX_SUBTITLE_BYTES;

const API_URL: &str = "https://api.opensubtitles.com/api/v1";
const HTTP_TIMEOUT: Duration = Duration::from_secs(20);
/// OpenSubtitles rejects requests without an app name in the user agent.
const USER_AGENT: &str = concat!("Blockbuster v", env!("CARGO_PKG_VERSION"));
/// The movie hash reads this much from each end of the file.
const HASH_CHUNK: u64 = 64 * 1024;

/// What to search for. Parameters are sent in alphabetical order, as OpenSubtitles asks
/// (other orders are answered with a redirect).
pub struct SearchQuery<'a> {
    pub imdb_id: Option<u32>,
    pub title: &'a str,
    pub year: Option<i32>,
    /// ISO 639-1 codes, e.g. ["en", "pt-br"].
    pub languages: &'a [String],
    pub moviehash: Option<String>,
}

/// One downloadable subtitle file from a search.
#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SubtitleResult {
    pub file_id: i64,
    /// The release the subtitle was made for, e.g. "Arrival.2016.1080p.BluRay.x264".
    pub release: String,
    pub language: Option<String>,
    pub downloads: i64,
    pub hearing_impaired: bool,
    /// Made for exactly this file (its movie hash matched), so it should be in sync.
    pub hash_match: bool,
}

/// A downloaded subtitle file.
pub struct Download {
    pub bytes: Vec<u8>,
    pub file_name: Option<String>,
    /// Downloads left today, as OpenSubtitles reports it.
    pub remaining: Option<i64>,
}

#[derive(Deserialize)]
struct SearchReply {
    #[serde(default)]
    data: Vec<SearchItem>,
}

#[derive(Deserialize)]
struct SearchItem {
    attributes: Attributes,
}

#[derive(Deserialize)]
struct Attributes {
    language: Option<String>,
    download_count: Option<i64>,
    hearing_impaired: Option<bool>,
    release: Option<String>,
    moviehash_match: Option<bool>,
    #[serde(default)]
    files: Vec<FileRef>,
}

#[derive(Deserialize)]
struct FileRef {
    file_id: i64,
    file_name: Option<String>,
}

#[derive(Deserialize)]
struct DownloadReply {
    link: String,
    file_name: Option<String>,
    remaining: Option<i64>,
}

pub struct OpenSubtitles {
    agent: ureq::Agent,
    api_key: String,
}

impl OpenSubtitles {
    pub fn new(api_key: String) -> Self {
        let agent = ureq::Agent::config_builder().timeout_global(Some(HTTP_TIMEOUT)).build().into();
        OpenSubtitles { agent, api_key }
    }

    /// Subtitles for a movie, files made for this exact video first, then the most downloaded.
    pub fn search(&self, query: &SearchQuery) -> Result<Vec<SubtitleResult>, String> {
        let mut request = self.agent.get(format!("{API_URL}/subtitles"));
        if let Some(imdb_id) = query.imdb_id {
            request = request.query("imdb_id", imdb_id.to_string());
        }
        if !query.languages.is_empty() {
            let mut languages: Vec<String> = query.languages.iter().map(|code| code.to_ascii_lowercase()).collect();
            languages.sort();
            request = request.query("languages", languages.join(","));
        }
        if let Some(hash) = &query.moviehash {
            request = request.query("moviehash", hash);
        }
        if query.imdb_id.is_none() {
            request = request.query("query", query.title.to_lowercase());
        }
        request = request.query("type", "movie");
        if let (None, Some(year)) = (query.imdb_id, query.year) {
            request = request.query("year", year.to_string());
        }
        let reply: SearchReply = request
            .header("Api-Key", &self.api_key)
            .header("User-Agent", USER_AGENT)
            .call()
            .map_err(api_error)?
            .body_mut()
            .read_json()
            .map_err(|error| format!("OpenSubtitles sent an unexpected reply: {error}"))?;
        Ok(results(reply))
    }

    /// Downloads one subtitle file. Each call counts against the daily download quota.
    pub fn download(&self, file_id: i64) -> Result<Download, String> {
        let reply: DownloadReply = self
            .agent
            .post(format!("{API_URL}/download"))
            .header("Api-Key", &self.api_key)
            .header("User-Agent", USER_AGENT)
            .header("Accept", "application/json")
            .send_json(json!({ "file_id": file_id }))
            .map_err(api_error)?
            .body_mut()
            .read_json()
            .map_err(|error| format!("OpenSubtitles sent an unexpected reply: {error}"))?;
        let bytes = self
            .agent
            .get(&reply.link)
            .call()
            .map_err(api_error)?
            .body_mut()
            .with_config()
            .limit(MAX_SUBTITLE_BYTES)
            .read_to_vec()
            .map_err(|error| format!("Couldn't download the subtitle: {error}"))?;
        Ok(Download { bytes, file_name: reply.file_name, remaining: reply.remaining })
    }
}

fn results(reply: SearchReply) -> Vec<SubtitleResult> {
    let mut results: Vec<SubtitleResult> = reply
        .data
        .into_iter()
        .flat_map(|item| {
            let attributes = item.attributes;
            attributes.files.into_iter().map(move |file| SubtitleResult {
                file_id: file.file_id,
                release: attributes
                    .release
                    .clone()
                    .filter(|release| !release.trim().is_empty())
                    .or(file.file_name)
                    .unwrap_or_else(|| format!("Subtitle {}", file.file_id)),
                language: attributes.language.clone(),
                downloads: attributes.download_count.unwrap_or(0),
                hearing_impaired: attributes.hearing_impaired.unwrap_or(false),
                hash_match: attributes.moviehash_match.unwrap_or(false),
            })
        })
        .collect();
    results.sort_by(|a, b| b.hash_match.cmp(&a.hash_match).then(b.downloads.cmp(&a.downloads)));
    results
}

/// Turns an HTTP failure into a message that says what to do about it.
fn api_error(error: ureq::Error) -> String {
    match error {
        ureq::Error::StatusCode(401 | 403) => {
            "OpenSubtitles rejected the API key. Check OPENSUBTITLES_API_KEY.".to_string()
        }
        ureq::Error::StatusCode(406) => {
            "Today's OpenSubtitles download limit is used up. Try again tomorrow.".to_string()
        }
        ureq::Error::StatusCode(429) => "OpenSubtitles is limiting requests. Wait a moment and try again.".to_string(),
        ureq::Error::StatusCode(status) => format!("OpenSubtitles answered with HTTP {status}."),
        error => format!("Couldn't reach OpenSubtitles: {error}"),
    }
}

/// The numeric IMDb id OpenSubtitles expects, from OMDb's "tt0133093".
pub fn imdb_number(imdb_id: &str) -> Option<u32> {
    imdb_id.strip_prefix("tt")?.parse().ok()
}

/// OpenSubtitles' movie hash: the file size plus the 64-bit little-endian words of its first
/// and last 64 KB, wrapping, as 16 hex digits. `None` for files too small to hash.
pub fn moviehash(path: &Path) -> io::Result<Option<String>> {
    let mut file = File::open(path)?;
    let size = file.metadata()?.len();
    if size < HASH_CHUNK * 2 {
        return Ok(None);
    }
    let mut hash = size;
    let mut chunk = vec![0u8; HASH_CHUNK as usize];
    for offset in [0, size - HASH_CHUNK] {
        file.seek(SeekFrom::Start(offset))?;
        file.read_exact(&mut chunk)?;
        for word in chunk.chunks_exact(8) {
            hash = hash.wrapping_add(u64::from_le_bytes(word.try_into().unwrap()));
        }
    }
    Ok(Some(format!("{hash:016x}")))
}

#[cfg(test)]
mod tests {
    use std::io::Write;

    use super::*;

    #[test]
    fn parses_search_results_and_ranks_exact_matches_first() {
        let reply: SearchReply = serde_json::from_str(
            r#"{"total_count":3,"data":[
                {"id":"1","type":"subtitle","attributes":{"language":"en","download_count":900,
                 "hearing_impaired":false,"release":"Arrival.2016.720p","moviehash_match":false,
                 "files":[{"file_id":11,"file_name":"arrival.720p.srt"}]}},
                {"id":"2","type":"subtitle","attributes":{"language":"en","download_count":50,
                 "hearing_impaired":true,"release":" ","moviehash_match":true,
                 "files":[{"file_id":22,"file_name":"arrival.sdh.srt"}]}},
                {"id":"3","type":"subtitle","attributes":{"language":"fr","download_count":1200,
                 "files":[]}}
            ]}"#,
        )
        .unwrap();

        let found = results(reply);
        assert_eq!(
            found,
            vec![
                SubtitleResult {
                    file_id: 22,
                    release: "arrival.sdh.srt".into(),
                    language: Some("en".into()),
                    downloads: 50,
                    hearing_impaired: true,
                    hash_match: true,
                },
                SubtitleResult {
                    file_id: 11,
                    release: "Arrival.2016.720p".into(),
                    language: Some("en".into()),
                    downloads: 900,
                    hearing_impaired: false,
                    hash_match: false,
                },
            ]
        );
    }

    #[test]
    fn explains_api_errors() {
        assert!(api_error(ureq::Error::StatusCode(401)).contains("OPENSUBTITLES_API_KEY"));
        assert!(api_error(ureq::Error::StatusCode(406)).contains("download limit"));
        assert!(api_error(ureq::Error::StatusCode(429)).contains("limiting"));
        assert_eq!(api_error(ureq::Error::StatusCode(500)), "OpenSubtitles answered with HTTP 500.");
    }

    #[test]
    fn reads_imdb_numbers() {
        assert_eq!(imdb_number("tt0133093"), Some(133093));
        assert_eq!(imdb_number("0133093"), None);
        assert_eq!(imdb_number("N/A"), None);
    }

    #[test]
    fn hashes_size_plus_both_ends() {
        let dir = tempfile::tempdir().unwrap();
        let small = dir.path().join("small.mkv");
        std::fs::write(&small, vec![0u8; 1000]).unwrap();
        assert_eq!(moviehash(&small).unwrap(), None);

        // 128 KB + 8 bytes: the first word is 1, the last word is 2, everything else is 0.
        let path = dir.path().join("clip.mkv");
        let mut bytes = vec![0u8; (HASH_CHUNK * 2 + 8) as usize];
        bytes[0] = 1;
        let len = bytes.len();
        bytes[len - 8] = 2;
        File::create(&path).unwrap().write_all(&bytes).unwrap();
        let expected = len as u64 + 1 + 2;
        assert_eq!(moviehash(&path).unwrap(), Some(format!("{expected:016x}")));
    }
}
