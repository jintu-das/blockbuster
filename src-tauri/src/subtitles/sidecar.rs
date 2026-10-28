use std::fs;
use std::path::Path;

use serde::Serialize;

use super::SUBTITLE_EXTENSIONS;
use crate::library::is_video;

/// A subtitle file next to a video, named after it: `Movie.srt`, `Movie.en.srt`,
/// `Movie.eng.forced.ass`. Read-only, like the video.
#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Sidecar {
    /// Name within the video's folder; also how a choice refers to it.
    pub file_name: String,
    /// ISO 639-1 code (with a region when the name has one, e.g. "pt-BR").
    pub language: Option<String>,
    /// Lowercase extension, e.g. "srt".
    pub format: String,
    /// What the name says beyond the video's name and language, e.g. "forced" or "SDH".
    pub tags: Option<String>,
}

/// Common languages by ISO 639-1 code, with the names and 639-2 codes subtitle files use.
const LANGUAGES: &[(&str, &[&str])] = &[
    ("ar", &["ar", "ara", "arabic"]),
    ("bg", &["bg", "bul", "bulgarian"]),
    ("cs", &["cs", "cze", "ces", "czech"]),
    ("da", &["da", "dan", "danish"]),
    ("de", &["de", "ger", "deu", "german", "deutsch"]),
    ("el", &["el", "gre", "ell", "greek"]),
    ("en", &["en", "eng", "english"]),
    ("es", &["es", "spa", "spanish", "espanol"]),
    ("et", &["et", "est", "estonian"]),
    ("fa", &["fa", "per", "fas", "persian", "farsi"]),
    ("fi", &["fi", "fin", "finnish"]),
    ("fr", &["fr", "fre", "fra", "french", "francais"]),
    ("he", &["he", "heb", "hebrew"]),
    ("hi", &["hi", "hin", "hindi"]),
    ("hr", &["hr", "hrv", "croatian"]),
    ("hu", &["hu", "hun", "hungarian"]),
    ("id", &["id", "ind", "indonesian"]),
    ("it", &["it", "ita", "italian"]),
    ("ja", &["ja", "jpn", "japanese"]),
    ("ko", &["ko", "kor", "korean"]),
    ("lt", &["lt", "lit", "lithuanian"]),
    ("lv", &["lv", "lav", "latvian"]),
    ("ms", &["ms", "may", "msa", "malay"]),
    ("nl", &["nl", "dut", "nld", "dutch"]),
    ("no", &["no", "nor", "nob", "norwegian"]),
    ("pl", &["pl", "pol", "polish"]),
    ("pt", &["pt", "por", "portuguese"]),
    ("ro", &["ro", "rum", "ron", "romanian"]),
    ("ru", &["ru", "rus", "russian"]),
    ("sk", &["sk", "slo", "slk", "slovak"]),
    ("sl", &["sl", "slv", "slovenian"]),
    ("sr", &["sr", "srp", "serbian"]),
    ("sv", &["sv", "swe", "swedish"]),
    ("th", &["th", "tha", "thai"]),
    ("tr", &["tr", "tur", "turkish"]),
    ("uk", &["uk", "ukr", "ukrainian"]),
    ("vi", &["vi", "vie", "vietnamese"]),
    ("zh", &["zh", "chi", "zho", "chinese"]),
];

/// The language a single name token stands for: "en", "eng", "English", or a regional
/// "pt-BR" / "pt_br" (kept as "pt-BR").
fn language_of_token(token: &str) -> Option<String> {
    let lower = token.to_ascii_lowercase();
    let (base, region) = match lower.split_once(['-', '_']) {
        Some((base, region)) if region.len() == 2 && region.chars().all(|c| c.is_ascii_alphabetic()) => {
            (base, Some(region.to_ascii_uppercase()))
        }
        _ => (lower.as_str(), None),
    };
    let (code, _) = LANGUAGES.iter().find(|(_, aliases)| aliases.contains(&base))?;
    Some(match region {
        Some(region) => format!("{code}-{region}"),
        None => (*code).to_string(),
    })
}

/// The language named in a subtitle file name, from its last token that names one:
/// "The.Matrix.1999.eng.srt" is English. Tokens are split on `.`, `_`, spaces and brackets.
pub fn guess_language(file_name: &str) -> Option<String> {
    let stem = file_name.rsplit_once('.').map_or(file_name, |(stem, _)| stem);
    stem.split(['.', ' ', '[', ']', '(', ')']).rev().find_map(language_of_token)
}

/// The lowercase extension of `name` if it is a subtitle format Blockbuster accepts.
pub fn subtitle_format(name: &str) -> Option<String> {
    let (_, extension) = name.rsplit_once('.')?;
    let extension = extension.to_ascii_lowercase();
    SUBTITLE_EXTENSIONS.contains(&extension.as_str()).then_some(extension)
}

/// Whether a subtitle name (without extension, lowercase) is named after the video `stem`:
/// the same name, or that name followed by `.<language and tags>`.
fn named_after(name_stem: &str, stem: &str) -> bool {
    name_stem.strip_prefix(stem).is_some_and(|rest| rest.is_empty() || rest.starts_with('.'))
}

/// Subtitle files in `video`'s folder named after it, sorted by name. When another video's
/// name extends this one (`Movie.mkv` and `Movie.Extended.mkv`), a subtitle goes to the video
/// with the longest matching name, so `Movie.Extended.en.srt` is not Movie's. An unreadable
/// folder gives none: sidecars are optional and playback still works without them.
pub fn find_sidecars(video: &Path) -> Vec<Sidecar> {
    let (Some(folder), Some(stem)) = (video.parent(), video.file_stem().and_then(|stem| stem.to_str())) else {
        return Vec::new();
    };
    let stem_lower = stem.to_lowercase();
    let Ok(entries) = fs::read_dir(folder) else { return Vec::new() };
    let names: Vec<String> = entries
        .filter_map(|entry| entry.ok()?.file_name().into_string().ok())
        .filter(|name| !name.starts_with('.'))
        .collect();
    let other_videos: Vec<String> = names
        .iter()
        .filter(|name| is_video(Path::new(name)))
        .filter_map(|name| Some(Path::new(name).file_stem()?.to_str()?.to_lowercase()))
        .filter(|other| other.len() > stem_lower.len() && named_after(other, &stem_lower))
        .collect();
    let mut sidecars: Vec<Sidecar> = names
        .into_iter()
        .filter_map(|file_name| {
            let format = subtitle_format(&file_name)?;
            let name_stem = &file_name[..file_name.len() - format.len() - 1];
            let name_lower = name_stem.to_lowercase();
            if !named_after(&name_lower, &stem_lower) || other_videos.iter().any(|other| named_after(&name_lower, other)) {
                return None;
            }
            // Case-insensitive match above; the prefix is sliced from the original name, so it
            // must be the same length there (not always so outside ASCII).
            if name_stem.get(..stem.len())?.to_lowercase() != stem_lower {
                return None;
            }
            let rest = &name_stem[stem.len()..];
            let rest = if rest.is_empty() { rest } else { rest.strip_prefix('.')? };
            let language = rest.split('.').find_map(language_of_token);
            let tags: Vec<&str> = rest
                .split('.')
                .filter(|token| !token.is_empty() && language_of_token(token).is_none())
                .collect();
            Some(Sidecar { language, format, tags: (!tags.is_empty()).then(|| tags.join(" ")), file_name })
        })
        .collect();
    sidecars.sort_by(|a, b| a.file_name.cmp(&b.file_name));
    sidecars
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn guesses_language_from_codes_and_names() {
        assert_eq!(guess_language("The.Matrix.1999.eng.srt").as_deref(), Some("en"));
        assert_eq!(guess_language("Amelie [French].ass").as_deref(), Some("fr"));
        assert_eq!(guess_language("Movie.pt-BR.srt").as_deref(), Some("pt-BR"));
        assert_eq!(guess_language("Movie.pt_br.srt").as_deref(), Some("pt-BR"));
        assert_eq!(guess_language("Big.Fish.2003.srt"), None);
    }

    #[test]
    fn accepts_only_subtitle_formats() {
        assert_eq!(subtitle_format("a.SRT").as_deref(), Some("srt"));
        assert_eq!(subtitle_format("a.ass").as_deref(), Some("ass"));
        assert_eq!(subtitle_format("a.mkv"), None);
        assert_eq!(subtitle_format("srt"), None);
    }

    #[test]
    fn finds_sidecars_named_after_the_video() {
        let dir = tempfile::tempdir().unwrap();
        for name in [
            "Arrival.mkv",
            "Arrival.srt",
            "Arrival.en.forced.SRT",
            "arrival.fre.ass",
            "Arrival 2.srt",
            "Arrivals.srt",
            ".Arrival.srt",
            "Arrival.nfo",
        ] {
            fs::write(dir.path().join(name), "").unwrap();
        }

        let sidecars = find_sidecars(&dir.path().join("Arrival.mkv"));
        let found: Vec<(&str, Option<&str>, Option<&str>)> = sidecars
            .iter()
            .map(|sidecar| (sidecar.file_name.as_str(), sidecar.language.as_deref(), sidecar.tags.as_deref()))
            .collect();
        assert_eq!(
            found,
            vec![
                ("Arrival.en.forced.SRT", Some("en"), Some("forced")),
                ("Arrival.srt", None, None),
                ("arrival.fre.ass", Some("fr"), None),
            ]
        );
        assert_eq!(sidecars[0].format, "srt");
    }

    #[test]
    fn subtitles_of_a_longer_named_video_are_not_shared() {
        let dir = tempfile::tempdir().unwrap();
        for name in ["Movie.mkv", "Movie.Extended.mkv", "Movie.en.srt", "Movie.Extended.en.srt", "Movie.Extended.txt.srt"] {
            fs::write(dir.path().join(name), "").unwrap();
        }
        let names = |video: &str| -> Vec<String> {
            find_sidecars(&dir.path().join(video)).into_iter().map(|sidecar| sidecar.file_name).collect()
        };
        assert_eq!(names("Movie.mkv"), ["Movie.en.srt"]);
        assert_eq!(names("Movie.Extended.mkv"), ["Movie.Extended.en.srt", "Movie.Extended.txt.srt"]);
    }

    #[test]
    fn unreadable_folder_has_no_sidecars() {
        assert!(find_sidecars(Path::new("/does/not/exist/A.mkv")).is_empty());
    }
}
