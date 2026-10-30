<p align="center">
  <img src="app-icon.png" alt="Blockbuster logo" width="128" height="128">
</p>

<h1 align="center">Blockbuster</h1>

<p align="center">
  Your movie folder, as a beautiful library.<br>
  Browse with posters and details, press play, and pick up right where you left off.
</p>

---

## What it does

- **Turns a folder into a library.** Choose the folder where your movies live. Blockbuster finds every video inside it, including subfolders, and lists them with posters, year, quality and length.
- **Remembers where you stopped.** Movies play in [mpv](https://mpv.io). Close the player at any time and Blockbuster resumes from that point next time.
- **Shows what you have.** See 4K, 1080p and HDR badges, plots, cast, ratings and audio formats. Details are saved, so they work offline.
- **Helps you choose.** The Home page features continue watching, recently added, unwatched and 4K shelves. The Movies page lets you search, filter, sort and group your whole collection.
- **Handles subtitles.** Use the ones inside the video or next to it, add your own, or download from OpenSubtitles. Your choice is remembered for each movie.
- **Never touches your files.** Blockbuster only reads your movies. It never moves, renames or deletes them.

## Install

Blockbuster runs on Linux. These steps are for Fedora.

1. **Install the player and media tools:**

   ```bash
   sudo dnf install mpv ffmpeg
   ```

   `mpv` plays your movies. `ffmpeg` reads quality and length, and makes thumbnails.

2. **Download** the latest `blockbuster-<version>.x86_64.rpm` from the [Releases page](https://github.com/jintu-das/blockbuster/releases/latest).

3. **Install it:**

   ```bash
   sudo dnf install ./blockbuster-*.x86_64.rpm
   ```

4. **Open Blockbuster** from your app menu.

Prefer to build it yourself? See [Build from source](#build-from-source).

## Getting started

1. **Choose your movie folder.** On first launch, click **Choose folder** and pick the folder that holds your movies.
2. **Wait a moment.** Your movies appear right away. Quality badges, lengths and thumbnails fill in over the next few minutes as Blockbuster reads each file.
3. **Press play.** Click a movie to start it in mpv. Close mpv whenever you like; your place is saved.
4. **Come back later.** Click the movie again, or use **Continue watching** on the Home page, to resume.

Blockbuster checks your folder each time it starts. After adding or removing movies while it is open, click **Scan library** in the top bar.

## Using Blockbuster

### Home

A rotating banner features a movie you're partway through, followed by a few you haven't watched yet. Below it, shelves group your collection: continue watching, recently added, unwatched, 4K, the decade you have the most movies from, and movies to watch again. **View all** on any shelf opens the matching list.

### Movies

Every movie in your library. Type in the search box at the top to find a title. Use the menus to:

- **Filter** by watch status, quality, decade or genre.
- **Sort** by title, release year, recently added, recently played, file size and more.
- **Group** into sections: A to Z, decade, quality, watch status or folder.
- **Switch** between a poster grid and a compact list.

Your filters stay in place when you go back to the list.

### Movie details

Click a movie's title to open its page: the plot, cast and crew, ratings from IMDb, Rotten Tomatoes and Metacritic, and technical details such as resolution, audio and file size. From here you can resume, or start over from the beginning.

### Playback

- Your position is saved every 10 seconds and whenever mpv closes.
- A movie watched past 95% counts as watched and starts from the beginning next time.
- Opened something by mistake? If you close it within 10 seconds, nothing is recorded.

### Subtitles

On a movie's page, the **Subtitles** card lists every option:

- **Automatic**: let mpv choose.
- **Off**: no subtitles.
- **In the video**: subtitle tracks inside the video file.
- **Next to the file**: files in the same folder named after the movie, such as `Arrival.en.srt`.
- **Added**: files you add from your computer (`.srt`, `.ass`, `.ssa`, `.vtt`, `.sub`) or download from OpenSubtitles.

The option you select is used every time that movie plays.

### Keyboard shortcut

Press `Ctrl+B` to collapse or expand the sidebar.

## Name your files for the best results

Blockbuster reads the title and year from each file name. Including the year gives the most accurate posters and details. These all work:

```
Arrival (2016).mkv
Blade Runner 2049 (2017) [2160p].mkv
Dune.Part.Two.2024.2160p.WEB-DL.mkv
Spirited_Away_2001.mp4
```

Supported formats: `.mkv`, `.mp4`, `.m4v`, `.avi`, `.mov`, `.webm`, `.wmv`, `.ts`. Hidden files and folders are skipped.

## Posters and online subtitles (optional)

Blockbuster works without any accounts. Two free services add more:

| Service | What it adds | Without it |
|---|---|---|
| [OMDb](https://www.omdbapi.com/apikey.aspx) | Posters, plot, cast, ratings, genres | A frame from the video is used as the thumbnail |
| [OpenSubtitles](https://www.opensubtitles.com/consumers) | Search and download subtitles | Subtitle files on your computer still work |

**To set them up:**

1. Sign up for a free key at the links above. For OMDb, click the activation link in the email you receive.
2. Save your keys:

   ```bash
   mkdir -p ~/.config/environment.d
   cat > ~/.config/environment.d/blockbuster.conf <<'EOF'
   OMDB_API_KEY=your_omdb_key
   OPENSUBTITLES_API_KEY=your_opensubtitles_key
   EOF
   chmod 600 ~/.config/environment.d/blockbuster.conf
   ```

   Leave out the line for any key you don't have.

3. Log out and back in, then open Blockbuster.

Posters and details for your existing movies download automatically in the background. You don't need to rescan.

To try a key once without saving it, start Blockbuster from a terminal: `OMDB_API_KEY=your_key blockbuster`.

## Update or uninstall

- **Update:** download the newer RPM and run `sudo dnf install ./blockbuster-*.x86_64.rpm`.
- **Uninstall:** `sudo dnf remove blockbuster`.

Your library, watch progress and thumbnails are kept either way. To remove them too, delete `~/.local/share/com.jintudas.blockbuster/`.

## Troubleshooting

**Movies show a video frame instead of a poster.**
Set up an [OMDb key](#posters-and-online-subtitles-optional). If only some movies are missing posters, add the year to their file names and click **Scan library**.

**A movie has the wrong title or poster.**
Rename the file to the [recommended format](#name-your-files-for-the-best-results) and click **Scan library**. A renamed file counts as a new movie, so its saved position starts fresh.

**Playing a movie says "mpv is not installed".**
Run `sudo dnf install mpv`.

**My movies disappeared.**
Is the drive holding them connected? Blockbuster hides movies it can't find instead of deleting them, and won't empty your library when a drive is unplugged. Reconnect it and click **Scan library**; everything returns with its progress.

**The app icon didn't change after an update.**
Log out and back in to refresh the icon cache.

## Your data

Everything Blockbuster creates stays on your computer, in `~/.local/share/com.jintudas.blockbuster/`:

| Item | Contents |
|---|---|
| `blockbuster.db` | Your library, settings and watch progress |
| `thumbnails/` | Posters and video frames |
| `subtitles/` | Copies of subtitles you added or downloaded |

The only things sent over the internet are movie titles to OMDb and OpenSubtitles, and only when you've added their keys.

---

## For developers

### Build from source

1. Install the build tools and libraries (you also need [Node.js](https://nodejs.org) and [Rust](https://rustup.rs)):

   ```bash
   sudo dnf install webkit2gtk4.1-devel gtk3-devel glib2-devel openssl-devel \
     libappindicator-gtk3-devel librsvg2-devel libxdo-devel mpv ffmpeg
   ```

2. Install the JavaScript packages and build the RPM:

   ```bash
   npm install
   npm run tauri build -- --bundles rpm
   ```

3. Install the package from `src-tauri/target/release/bundle/rpm/`. If the same version is already installed, use `sudo dnf reinstall` instead of `install`.

In development, keys set with `export OMDB_API_KEY=...` in your shell are picked up by `npm run tauri dev`.

### Commands

| Command | What it does |
|---|---|
| `npm run tauri dev` | Run the app in development (Vite on port 1420, then the Rust backend) |
| `npm run tauri build` | Build a release bundle |
| `npm run build` | Type-check and build the frontend only |
| `cargo test` (in `src-tauri/`) | Run the backend tests |
| `cargo test -- --ignored` (in `src-tauri/`) | Also run the tests that drive real mpv and ffmpeg |

To inspect the catalog directly:

```bash
sqlite3 -readonly -header -column ~/.local/share/com.jintudas.blockbuster/blockbuster.db \
  "SELECT title, year, quality, duration_seconds, progress_seconds FROM movies;"
```

### Architecture

- **Tauri 2** for the desktop app and local file access, with the backend in Rust.
- **React 19 + TypeScript** for the UI, with TanStack Router and Query, Tailwind v4 and shadcn/ui.
- **SQLite** (bundled via rusqlite) for the catalog and playback progress.
- **mpv** for playback, controlled through its JSON IPC socket.
- **ffprobe / ffmpeg** for quality, duration and frame thumbnails.
- **OMDb API** for posters, plot, credits and ratings. It is used instead of TMDB, which is not reachable from India.

Diagrams of the components and main flows are in [docs/architecture.md](docs/architecture.md). Code conventions and module details are in [CLAUDE.md](CLAUDE.md).
