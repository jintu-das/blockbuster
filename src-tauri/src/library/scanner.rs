use std::path::Path;
use std::time::{SystemTime, UNIX_EPOCH};

use walkdir::{DirEntry, WalkDir};

const VIDEO_EXTENSIONS: &[&str] = &["mkv", "mp4", "m4v", "avi", "mov", "webm", "wmv", "ts"];

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ScannedFile {
    pub path: String,
    pub size_bytes: i64,
    /// Last modification time in Unix seconds.
    pub modified_at: i64,
}

#[derive(Debug, Default)]
pub struct FolderScan {
    /// The folder that was scanned, as given.
    pub root: String,
    pub files: Vec<ScannedFile>,
    /// Subfolders that could not be listed and video files whose metadata could not be read.
    /// Their state is unknown, so the catalog must not treat movies at or under them as gone.
    pub unreadable_paths: Vec<String>,
}

pub fn unix_seconds(time: SystemTime) -> i64 {
    time.duration_since(UNIX_EPOCH).map_or(0, |duration| duration.as_secs() as i64)
}

fn is_hidden(entry: &DirEntry) -> bool {
    entry.file_name().to_str().is_some_and(|name| name.starts_with('.'))
}

pub(crate) fn is_video(path: &Path) -> bool {
    path.extension()
        .and_then(|ext| ext.to_str())
        .is_some_and(|ext| VIDEO_EXTENSIONS.contains(&ext.to_ascii_lowercase().as_str()))
}

/// Recursively lists video files under `root`, skipping hidden files and folders.
/// Symlinks are not followed and non-UTF-8 paths are skipped.
///
/// Fails if `root` itself cannot be read, so a missing or unreadable library never looks
/// like an empty one. Unreadable subfolders and files are reported in `unreadable_paths`.
pub fn scan_folder(root: &Path) -> Result<FolderScan, String> {
    std::fs::read_dir(root).map_err(|error| format!("Cannot read {}: {error}", root.display()))?;

    let mut scan = FolderScan { root: root.to_string_lossy().into_owned(), ..FolderScan::default() };
    let walker = WalkDir::new(root)
        .follow_links(false)
        .into_iter()
        .filter_entry(|entry| entry.depth() == 0 || !is_hidden(entry));

    for entry in walker {
        let entry = match entry {
            Ok(entry) => entry,
            Err(error) if error.depth() == 0 => {
                return Err(format!("Cannot read {}: {error}", root.display()));
            }
            Err(error) => {
                if let Some(path) = error.path().and_then(Path::to_str) {
                    scan.unreadable_paths.push(path.to_string());
                }
                continue;
            }
        };
        if !entry.file_type().is_file() || !is_video(entry.path()) {
            continue;
        }
        let Some(path) = entry.path().to_str() else { continue };
        let Ok(metadata) = entry.metadata() else {
            scan.unreadable_paths.push(path.to_string());
            continue;
        };
        let modified_at = metadata.modified().map_or(0, unix_seconds);

        scan.files.push(ScannedFile { path: path.to_string(), size_bytes: metadata.len() as i64, modified_at });
    }

    Ok(scan)
}

#[cfg(test)]
mod tests {
    use std::fs;
    use std::os::unix::fs::PermissionsExt;

    use super::*;

    fn names(files: &[ScannedFile], root: &Path) -> Vec<String> {
        let mut names: Vec<String> = files
            .iter()
            .map(|file| Path::new(&file.path).strip_prefix(root).unwrap().to_string_lossy().into_owned())
            .collect();
        names.sort();
        names
    }

    fn set_mode(path: &Path, mode: u32) {
        fs::set_permissions(path, fs::Permissions::from_mode(mode)).unwrap();
    }

    #[test]
    fn finds_videos_recursively_and_skips_hidden_and_other_files() {
        let dir = tempfile::tempdir().unwrap();
        let root = dir.path();
        fs::create_dir_all(root.join("Sci-Fi/Nested")).unwrap();
        fs::create_dir_all(root.join(".hidden")).unwrap();
        fs::write(root.join("Arrival_2016.mkv"), b"1234").unwrap();
        fs::write(root.join("Sci-Fi/Nested/Dune.2024.MP4"), b"").unwrap();
        fs::write(root.join("Sci-Fi/notes.txt"), b"").unwrap();
        fs::write(root.join(".hidden/Secret.mkv"), b"").unwrap();
        fs::write(root.join(".partial.mkv"), b"").unwrap();

        let scan = scan_folder(root).unwrap();

        assert_eq!(names(&scan.files, root), vec!["Arrival_2016.mkv", "Sci-Fi/Nested/Dune.2024.MP4"]);
        assert!(scan.unreadable_paths.is_empty());
        assert_eq!(scan.root, root.to_str().unwrap());
        let arrival = scan.files.iter().find(|file| file.path.ends_with("Arrival_2016.mkv")).unwrap();
        assert_eq!(arrival.size_bytes, 4);
        assert!(arrival.modified_at > 0);
    }

    #[test]
    fn rejects_a_missing_folder_or_a_file() {
        let dir = tempfile::tempdir().unwrap();
        fs::write(dir.path().join("movie.mkv"), b"").unwrap();
        assert!(scan_folder(&dir.path().join("nope")).is_err());
        assert!(scan_folder(&dir.path().join("movie.mkv")).is_err());
    }

    #[test]
    fn unreadable_root_is_an_error_not_an_empty_library() {
        let dir = tempfile::tempdir().unwrap();
        let root = dir.path().join("library");
        fs::create_dir(&root).unwrap();
        set_mode(&root, 0o000);
        let result = scan_folder(&root);
        set_mode(&root, 0o755);
        assert!(result.is_err());
    }

    #[test]
    fn unreadable_subfolder_is_reported() {
        let dir = tempfile::tempdir().unwrap();
        let root = dir.path();
        fs::create_dir(root.join("Locked")).unwrap();
        fs::write(root.join("Locked/Hidden.mkv"), b"").unwrap();
        fs::write(root.join("Arrival.mkv"), b"").unwrap();
        set_mode(&root.join("Locked"), 0o000);

        let scan = scan_folder(root);
        set_mode(&root.join("Locked"), 0o755);
        let scan = scan.unwrap();

        assert_eq!(names(&scan.files, root), vec!["Arrival.mkv"]);
        assert_eq!(scan.unreadable_paths, vec![root.join("Locked").to_str().unwrap().to_string()]);
    }
}
