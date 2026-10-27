# Blockbuster

Blockbuster is a personal desktop app for browsing and playing movies stored on your computer. Its first milestone focuses on one local folder, a browsable video catalog, playback through mpv, and reliable resume progress.

## MVP goal

Choose one folder, scan its video files, browse the results, play a file in mpv, and resume it from the saved position the next time it is opened.

## Planned MVP features

- Choose and remember one local library folder.
- Scan the folder for common video file types and save the catalog locally.
- Browse and search discovered files.
- Show a poster (OMDb) or a video frame (ffmpeg), plus quality and duration (ffprobe), for each video when possible.
- Show useful fallbacks when thumbnail generation or metadata reading fails.
- Open videos in mpv.
- Save playback position and offer to resume on the next play.
- Show scan progress, missing files, and clear error states.

## Planned architecture

- **Tauri** for the desktop application and local file access.
- **React + TypeScript** for the user interface.
- **SQLite** for the file catalog and playback progress.
- **mpv** for video playback, controlled through its local IPC interface.
- **FFmpeg** (ffprobe) for reading quality and duration, and ffmpeg for frame thumbnails.
- **OMDb API** for movie posters (TMDB is not reachable from India). Optional: set `OMDB_API_KEY`; without it, every movie gets a frame thumbnail.

The app will treat media files as read-only. Catalog data and generated thumbnails will be stored in Blockbuster's application data directory.

## Initial workflow

1. Choose a folder.
2. Scan its video files and generate thumbnails where possible.
3. Browse or search the catalog.
4. Play a file in mpv, or resume from its saved position.
5. Save progress when playback stops so it is available next time.

## Out of scope for the first milestone

- Multiple library folders or network/remote streaming.
- Online movie metadata beyond the poster (plot, cast, ratings).
- Automatic TV season and episode matching.
- Favorites, ratings, watchlists, and recommendations.
- User accounts, cloud sync, and transcoding.

## First success check

Select a folder containing several videos, play one for a few minutes, close playback and Blockbuster, reopen the app, and confirm that the video is still listed and resumes near its saved position.

## Project status

This README describes the agreed MVP direction. Implementation details and setup instructions will be added as the application is built.
