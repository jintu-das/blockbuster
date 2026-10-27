# Blockbuster

Blockbuster is a personal desktop app for browsing and playing movies stored on your computer. Point it at one folder and it builds a local catalog with posters, quality and duration, plays movies in mpv, and resumes each one where you left off.

## MVP goal

Choose one folder, scan its video files, browse the results, play a file in mpv, and resume it from the saved position the next time it is opened.

## Features

| Feature | Status |
|---|---|
| Choose and remember one library folder | Done |
| Scan for common video files into a local SQLite catalog | Done |
| Browse the catalog (Home and Library pages) | Done |
| Quality badge (4K, 1080p, HDR) and duration from ffprobe | Done |
| Posters from OMDb, with an ffmpeg frame as fallback | Done |
| Play in mpv, save position, resume on next play | Done (Linux/Unix only) |
| Keep progress for files that go missing and come back | Done |
| Search the catalog | Not started |
| Scan progress display | Not started |
| Real disk usage in the sidebar | Mock data |
| Watchlist and favorites on Home | Home sections are a shuffled catalog for now |

## Setup (Fedora)

1. Install the build and runtime dependencies:

   ```bash
   sudo dnf install webkit2gtk4.1-devel gtk3-devel glib2-devel openssl-devel \
     libappindicator-gtk3-devel librsvg2-devel libxdo-devel mpv ffmpeg
   ```

   You also need Node.js and a Rust toolchain. `mpv` is required for playback. `ffmpeg` provides `ffprobe` for quality and duration, and frame thumbnails.

2. Install the JavaScript packages:

   ```bash
   npm install
   ```

3. Optional: get posters. Request a free key at [omdbapi.com/apikey.aspx](https://www.omdbapi.com/apikey.aspx) (1,000 requests a day), click the activation link in the email, then add it to your shell:

   ```bash
   echo 'export OMDB_API_KEY=your_key' >> ~/.bashrc
   source ~/.bashrc
   ```

   Without a key, every movie gets a frame from the video instead of a poster. OMDb is used because TMDB is not reachable from India.

## Running

| Command | What it does |
|---|---|
| `npm run tauri dev` | Run the app in development (Vite on port 1420, then the Rust backend) |
| `npm run tauri build` | Build a release bundle |
| `npm run build` | Type-check and build the frontend only |
| `cargo test` (in `src-tauri/`) | Run the backend tests |
| `cargo test -- --ignored` (in `src-tauri/`) | Also run the tests that drive real mpv and ffmpeg |

## How it works

1. Choose a folder. Blockbuster scans it and saves the catalog. Media files are only ever read.
2. A background pass reads each movie's quality and duration, then fetches a poster or grabs a frame. Cards fill in as it goes.
3. Click a movie to play it in mpv. The position is saved every 10 seconds and when mpv closes.
4. Play it again to resume. Movies watched past 95% start over.

Rescan after adding or removing files. Changed files are detected by size; movies that disappear are hidden, not deleted, so their progress returns with them.

Everything Blockbuster generates lives in its app data directory, `~/.local/share/com.jintudas.blockbuster/` on Linux:

- `blockbuster.db`: the catalog, settings and playback progress (SQLite)
- `thumbnails/`: posters and frames

To inspect the catalog:

```bash
sqlite3 -readonly -header -column ~/.local/share/com.jintudas.blockbuster/blockbuster.db \
  "SELECT title, year, quality, duration_seconds, progress_seconds FROM movies;"
```

## Architecture

- **Tauri 2** for the desktop app and local file access, with the backend in Rust.
- **React 19 + TypeScript** for the UI, with TanStack Router and Query, Tailwind v4 and shadcn/ui.
- **SQLite** (bundled via rusqlite) for the catalog and playback progress.
- **mpv** for playback, controlled through its JSON IPC socket.
- **ffprobe / ffmpeg** for quality, duration and frame thumbnails.
- **OMDb API** for posters.

Diagrams of the components and main flows are in [docs/architecture.md](docs/architecture.md). Code conventions and module details are in [CLAUDE.md](CLAUDE.md).

## Out of scope for the first milestone

- Multiple library folders or network/remote streaming.
- Online movie metadata beyond the poster (plot, cast, ratings).
- Automatic TV season and episode matching.
- Favorites, ratings, watchlists, and recommendations.
- User accounts, cloud sync, and transcoding.

## First success check

Select a folder containing several videos, play one for a few minutes, close playback and Blockbuster, reopen the app, and confirm that the video is still listed and resumes near its saved position.
