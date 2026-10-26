/// Tags that never appear in real titles, so the title ends at the first one.
const RELEASE_TAGS: &[&str] = &[
    "480p", "576p", "720p", "1080p", "1080i", "2160p", "hdr10", "bluray", "blu-ray", "brrip",
    "bdrip", "webrip", "web-dl", "webdl", "hdtv", "dvdrip", "x264", "x265", "h264", "h265", "hevc",
    "avc", "aac", "ac3", "dts",
];

/// Tags that are also ordinary words ("The Extended Family", "Web of Lies"). They are only
/// stripped from the end of a title, never used to cut it short.
const TRAILING_TAGS: &[&str] = &[
    "4k", "uhd", "hdr", "dv", "web", "remux", "proper", "repack", "extended", "unrated", "imax",
];

const MIN_YEAR: i32 = 1888;
const SECONDS_PER_YEAR: i64 = 31_556_952;

struct Token {
    text: String,
    /// Inside `()`, `[]` or `{}`, e.g. the year in "Arrival (2016)".
    bracketed: bool,
}

/// Calendar year for a Unix timestamp, accurate to within a day of New Year.
pub fn year_of(unix_seconds: i64) -> i32 {
    (1970 + unix_seconds / SECONDS_PER_YEAR) as i32
}

fn tokenize(stem: &str) -> Vec<Token> {
    let mut tokens = Vec::new();
    let mut current = String::new();
    let mut depth = 0u32;

    let mut flush = |current: &mut String, depth: u32| {
        if !current.is_empty() {
            tokens.push(Token { text: std::mem::take(current), bracketed: depth > 0 });
        }
    };

    for c in stem.chars() {
        match c {
            '(' | '[' | '{' => {
                flush(&mut current, depth);
                depth += 1;
            }
            ')' | ']' | '}' => {
                flush(&mut current, depth);
                depth = depth.saturating_sub(1);
            }
            '.' | '_' => flush(&mut current, depth),
            c if c.is_whitespace() => flush(&mut current, depth),
            c => current.push(c),
        }
    }
    flush(&mut current, depth);
    tokens
}

fn as_year(token: &str, max_year: i32) -> Option<i32> {
    if token.len() != 4 || !token.bytes().all(|b| b.is_ascii_digit()) {
        return None;
    }
    let year: i32 = token.parse().ok()?;
    (MIN_YEAR..=max_year).contains(&year).then_some(year)
}

fn is_tag(token: &str, tags: &[&str]) -> bool {
    tags.contains(&token.to_ascii_lowercase().as_str())
}

/// Derives a display title and release year from a file name without its extension.
///
/// Year candidates are 4-digit numbers up to `max_year` that are not the first word, so
/// "1917" keeps its numeric title and "Blade Runner 2049" is not read as a future release.
/// A bracketed year ("Arrival (2016)") wins over a bare one; otherwise the last candidate is
/// used. Everything from the year on, and any bracketed text, is dropped from the title.
/// Without a year, the title ends at the first unambiguous release tag such as "1080p".
/// Word-like tags ("Extended", "IMAX") are then trimmed from the end of the title.
///
/// A bare trailing number that is also a plausible year stays ambiguous ("Death Race 2000"
/// reads as year 2000); naming files "Title (Year)" avoids that.
pub fn parse_title(file_stem: &str, max_year: i32) -> (String, Option<i32>) {
    let tokens = tokenize(file_stem);
    let candidates: Vec<usize> = (1..tokens.len())
        .filter(|&index| as_year(&tokens[index].text, max_year).is_some())
        .collect();
    let year_index = candidates
        .iter()
        .rev()
        .find(|&&index| tokens[index].bracketed)
        .or(candidates.last())
        .copied();

    let (title_tokens, year) = match year_index {
        Some(index) => (&tokens[..index], as_year(&tokens[index].text, max_year)),
        None => {
            let end = tokens.iter().position(|token| is_tag(&token.text, RELEASE_TAGS)).unwrap_or(tokens.len());
            (&tokens[..end], None)
        }
    };

    let mut words: Vec<&str> =
        title_tokens.iter().filter(|token| !token.bracketed).map(|token| token.text.as_str()).collect();
    while words.len() > 1 && words.last().is_some_and(|word| is_tag(word, TRAILING_TAGS)) {
        words.pop();
    }
    let title = words
        .join(" ")
        .trim_matches(|c: char| c == '-' || c.is_whitespace())
        .to_string();

    if title.is_empty() {
        (file_stem.trim().to_string(), year)
    } else {
        (title, year)
    }
}

#[cfg(test)]
mod tests {
    use super::{parse_title, year_of};

    const MAX_YEAR: i32 = 2027;

    fn parsed(stem: &str) -> (String, Option<i32>) {
        parse_title(stem, MAX_YEAR)
    }

    #[test]
    fn underscores_and_trailing_year() {
        assert_eq!(parsed("Blade_Runner_2049_2017"), ("Blade Runner 2049".into(), Some(2017)));
    }

    #[test]
    fn future_number_in_title_is_not_a_year() {
        assert_eq!(parsed("Blade Runner 2049"), ("Blade Runner 2049".into(), None));
    }

    #[test]
    fn bracketed_year_wins_over_bare_number() {
        assert_eq!(parsed("Death Race 2000 (1975)"), ("Death Race 2000".into(), Some(1975)));
        assert_eq!(parsed("Blade Runner 2049 (2017) [2160p]"), ("Blade Runner 2049".into(), Some(2017)));
    }

    #[test]
    fn dotted_release_name() {
        assert_eq!(parsed("Dune.Part.Two.2024.2160p.WEB-DL"), ("Dune Part Two".into(), Some(2024)));
    }

    #[test]
    fn bracketed_year_and_quality() {
        assert_eq!(parsed("Spirited Away (2001) [1080p]"), ("Spirited Away".into(), Some(2001)));
    }

    #[test]
    fn leading_bracketed_group_is_dropped() {
        assert_eq!(parsed("[Group] Arrival 2016 1080p"), ("Arrival".into(), Some(2016)));
    }

    #[test]
    fn no_year_stops_at_release_tag() {
        assert_eq!(parsed("Arrival.1080p.BluRay.x264"), ("Arrival".into(), None));
    }

    #[test]
    fn word_like_tags_do_not_cut_titles() {
        assert_eq!(parsed("The Extended Family"), ("The Extended Family".into(), None));
        assert_eq!(parsed("A_Proper_Job"), ("A Proper Job".into(), None));
        assert_eq!(parsed("Web.of.Lies.1080p"), ("Web of Lies".into(), None));
    }

    #[test]
    fn trailing_word_like_tags_are_trimmed() {
        assert_eq!(parsed("Arrival.EXTENDED.IMAX.1080p"), ("Arrival".into(), None));
        assert_eq!(parsed("Dune.Part.Two.Remux"), ("Dune Part Two".into(), None));
    }

    #[test]
    fn no_year_no_tags() {
        assert_eq!(parsed("Home Video"), ("Home Video".into(), None));
    }

    #[test]
    fn numeric_title_is_not_a_year() {
        assert_eq!(parsed("1917"), ("1917".into(), None));
        assert_eq!(parsed("2001 A Space Odyssey 1968"), ("2001 A Space Odyssey".into(), Some(1968)));
    }

    #[test]
    fn empty_title_falls_back_to_stem() {
        assert_eq!(parsed("1080p"), ("1080p".into(), None));
    }

    #[test]
    fn year_of_unix_time() {
        assert_eq!(year_of(0), 1970);
        assert_eq!(year_of(1_793_000_000), 2026); // 2026-10-26
    }
}
