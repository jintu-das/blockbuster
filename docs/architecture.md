# Architecture

Blockbuster is a Tauri 2 desktop app. A React frontend in the webview calls a Rust backend over Tauri IPC. The backend owns all state in one SQLite file and drives three external tools: mpv for playback, ffprobe/ffmpeg for metadata and frames, the OMDb web API for posters and movie details (stored, so the details page works offline), and the OpenSubtitles API for subtitles the user searches for. Module-level detail lives in [CLAUDE.md](../CLAUDE.md).

## Components

The frontend only talks to the backend through `invoke()` commands, and the backend only pushes changes back through two events, which `useCatalogSync` turns into catalog refetches.

```mermaid
flowchart LR
  subgraph WV["Webview: React 19 + TanStack Query"]
    direction TB
    R["routes/ (thin)<br/>/ → HomePage<br/>/movies → MoviesPage (filters in URL)<br/>/movies/$movieId → MovieDetailsPage"]
    F["features/<br/>layout · home · movies · movie-details<br/>subtitles · library · theme"]
    Q[("Query cache<br/>['library', …]<br/>['thumbnail', id, file]<br/>['subtitles', id, …]")]
    S["useCatalogSync<br/>(in AppLayout)"]
    R --> F --> Q
  end

  subgraph RS["Rust backend: blockbuster_lib"]
    direction TB
    CMD["Commands (all via blocking())<br/>get/set_library_folder · scan_library<br/>list_movies · get_movie_details · get_thumbnail · play_movie<br/>list/add/remove/search/download_subtitle(s) · set_subtitle_choice"]
    LIB["library/<br/>scanner · title · catalog"]
    PLY["player/<br/>mpv · session"]
    MED["media/<br/>enrich (PassGate) · probe · poster"]
    SUB["subtitles/<br/>sidecar · store · opensubtitles"]
    DB[("db.rs<br/>Mutex#lt;Connection#gt;<br/>migrations v1–v6")]
    CMD --> LIB --> DB
    CMD --> PLY
    CMD --> SUB --> DB
    PLY -- "subtitle plan" --> SUB
    LIB -- "after scan: spawn" --> MED
    MED -- "short writes" --> DB
    PLY -- "save progress / 10 s" --> DB
  end

  subgraph EXT["Outside the app"]
    FS[/"Library folder<br/>(read-only)"/]
    MPV["mpv"]
    FF["ffprobe / ffmpeg"]
    OMDB["omdbapi.com<br/>(OMDB_API_KEY)"]
    OSUB["opensubtitles.com<br/>(OPENSUBTITLES_API_KEY)"]
    DATA[("App data dir<br/>blockbuster.db<br/>thumbnails/*.jpg<br/>subtitles/*")]
  end

  F -- "invoke()" --> CMD
  CMD -- "bytes / JSON" --> F
  PLY -- "event: playback-ended" --> S
  MED -- "event: library-updated (≤ every 3 s)" --> S
  S -- "invalidate movies" --> Q

  LIB -- "walk" --> FS
  PLY -- "spawn + JSON IPC socket" --> MPV
  MED -- "spawn" --> FF
  MED -- "HTTPS lookup + download" --> OMDB
  DB --- DATA
  MED -- "write JPEG" --> DATA
  SUB -- "sidecars (read)" --> FS
  SUB -- "HTTPS search + download" --> OSUB
  SUB -- "write copies" --> DATA
```

## Scan, then metadata fill-in

A scan runs when the app opens (`useStartupScan`, so files added or deleted while it was closed show up), when the user asks, and when Play finds a file gone. Every scan emits `library-updated` if it changed anything, and a scan that finds no files where the catalog has movies (an unmounted drive's empty mount point) is refused rather than applied. It only diffs the folder against the catalog, so it stays fast. Deleted files are marked `missing`, never removed, so their progress and details return if the file does. Quality, duration and thumbnails are filled in afterwards by a background pass, and the UI updates as results arrive. Thumbnails reach the webview as bytes from `get_thumbnail`, not through `asset://`, which WebKitGTK blocks on the dev server origin.

```mermaid
sequenceDiagram
  actor U as User
  participant UI as React (Movies page)
  participant C as scan_library
  participant DB as SQLite
  participant E as enrich pass (thread)
  participant T as ffprobe / OMDb / ffmpeg

  U->>UI: Click Rescan
  UI->>C: invoke("scan_library")
  C->>C: hold ScanLock, walk folder
  C->>DB: apply_scan (one transaction)
  C-)E: media::spawn (or queue a rerun)
  C-->>UI: ScanSummary
  UI->>UI: invalidate ['library'] → list_movies

  loop each pending movie
    E->>T: ffprobe → quality, duration, streams
    E->>DB: save_probe
    E->>T: OMDb lookup (if key) → reply + poster download
    E->>DB: save_poster (thumbnail + omdb_json)
    E->>T: ffmpeg frame (if still no image)
    E->>DB: save_frame / save_frame_failed
    E--)UI: library-updated (throttled 3 s)
    UI->>C: list_movies → new thumbnailFile
    UI->>C: get_thumbnail(id) → JPEG → data URL (cards: once near the viewport)
    UI->>C: get_movie_details(id) → omdb_json, media_json (details page)
  end
```

## Playback and resume

One movie plays at a time. The session thread saves the position every 10 s and when mpv exits, then tells the UI to refresh progress bars and Continue Watching.

```mermaid
sequenceDiagram
  actor U as User
  participant UI as MovieCard
  participant P as play_movie
  participant DB as SQLite
  participant M as mpv
  participant S as session thread

  U->>UI: Click poster
  UI->>P: invoke("play_movie", {movieId})
  P->>DB: path + saved progress
  opt file not found on disk
    P->>DB: rescan_saved_folder (ScanLock, apply_scan)
    P--)UI: library-updated → card disappears
    P-->>UI: error: removed, or drive not mounted
  end
  P->>DB: subtitle plan (choice, added files) + sidecars on disk
  P->>M: launch --start=#lt;progress#gt;, --sub-file per sidecar, --sid=no if Off, IPC socket
  P->>S: start tracking
  opt added subtitles, or an embedded / sidecar choice
    M--)S: track-list (file loaded)
    S->>M: sub-add #lt;added#gt; auto / select
    S->>M: set_property sid #lt;real track id#gt;
  end
  loop every 10 s
    M--)S: time-pos, duration
    S->>DB: save_playback
  end
  M--)S: end-file / quit
  S->>DB: final save (clear if >95% or <10 s)
  S--)UI: playback-ended
  UI->>UI: refetch → progress bar, Continue Watching
```
