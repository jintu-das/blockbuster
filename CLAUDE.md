# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Blockbuster is a personal desktop app (Tauri 2 + React 19 + TypeScript) for browsing and playing local movies. The user picks one library folder; the Rust backend scans it into a SQLite catalog that the Home and Library pages display. Media metadata (duration, thumbnails) and playback are not implemented yet. The MVP scope lives in [README.md](README.md). Read its "MVP goal", "Planned architecture" and "Out of scope" sections before adding features. Keep work inside the first-milestone scope: one library folder, local catalog, mpv playback, resume progress.

## Commands

- `npm run tauri dev`: run the desktop app. It starts Vite on port 1420 (`strictPort`, so it fails if the port is in use) and then `cargo run` in `src-tauri/`.
- `npm run tauri build`: build a release bundle (runs `npm run build` first, frontend output goes to `dist/`).
- `npm run build`: type-check (`tsc`) and build the frontend only.
- `cargo check` / `cargo test` from `src-tauri/`: backend-only checks. Run a single Rust test with `cargo test <test_name>` (e.g. `cargo test catalog`). `cargo clippy` needs the separate Fedora `clippy` package.

No JS test runner, linter or formatter is configured yet.

### Linux build prerequisites (Fedora)

The Rust build links against system GTK/WebKit libraries. If `glib-sys`, `gdk-sys` or similar fail with "pkg-config ... not found", install:

```bash
sudo dnf install webkit2gtk4.1-devel gtk3-devel glib2-devel openssl-devel \
  libappindicator-gtk3-devel librsvg2-devel libxdo-devel
```

The runtime will also need `mpv` and `ffmpeg` on `PATH` once playback and thumbnails are implemented.

## Architecture

- **Frontend** (`src/`): React app served by Vite. It calls the backend with `invoke("<command>", { args })` from `@tauri-apps/api/core`.
  - **Feature folders (required)**: all app code lives in `src/features/<feature>/`, split by role into `components/`, `hooks/`, `api/` (Tauri `invoke` wrappers and DTO mappers), `data/` (static config, mocks), `lib/` (pure helpers) and `types.ts`. Each feature exposes its public API through `index.ts`. Other features and routes import only from `@/features/<feature>`, never deep paths; files inside a feature use relative imports. Current features: `layout` (app shell: sidebar, header, disk usage), `theme` (provider, `useTheme`, toggle), `library` (catalog data, folder picker, movie grid and cards), `home`.
  - **Outside features**: only shadcn-owned code (`src/components/ui`, `src/hooks`, `src/lib/utils.ts`, all written by `npx shadcn add` per `components.json`) and the entry point `src/main.tsx`, which mounts app-wide providers (`QueryClientProvider`, `ThemeProvider`, `TooltipProvider`, `Toaster`) above `RouterProvider`. Don't put app code in those shadcn folders.
  - **Server state**: backend data goes through TanStack Query. Query and mutation keys live next to the API wrappers (`libraryKeys` in `src/features/library/api/library-api.ts`); mutations invalidate `libraryKeys.all`, and every library mutation uses a key under that prefix so `useLibraryBusy()` can disable all scan/folder buttons together. Queries never go stale on their own (`staleTime: Infinity`), so anything that changes the catalog must invalidate. Command errors reject with a plain string; show them with `errorMessage()` and `toast.add(...)` from `@/components/ui/toast`.
  - **Remaining mock data**: the sidebar disk-usage card (`src/features/layout/data/mock-disk-usage.ts`). Home's sections are a random order of the catalog (`seededOrder`, seeded once per visit so rescans don't reshuffle), not real watchlist or favorites.
  - **Theme**: `index.html` has an inline pre-paint script that applies the `dark` class; its storage key must match `THEME_STORAGE_KEY` in `src/features/theme/lib/theme-storage.ts`.
  - **Routing**: TanStack Router, file-based. Route files in `src/routes/` stay thin: they only bind a path to a page component exported by a feature (`__root.tsx` wraps `<Outlet />` in `AppLayout`). The Vite plugin regenerates `src/routeTree.gen.ts` on dev/build; never edit it by hand.
  - **UI**: Tailwind v4 (configured in `src/index.css`, no `tailwind.config`) and shadcn/ui (`base-nova` style, Base UI primitives, lucide icons). Add components with `npx shadcn@latest add <name>`; they land in `src/components/ui/`. Base UI uses a `render` prop, not `asChild`. For nav links, style a router `Link` with `buttonVariants()`.
  - Import alias `@/` maps to `src/` (set in both `tsconfig.json` and `vite.config.ts`).
- **Backend** (`src-tauri/`): `main.rs` only calls `blockbuster_lib::run()`. All app logic belongs in the library crate (`src/lib.rs` and modules under it). New commands are `#[tauri::command]` functions that must be registered in `tauri::generate_handler![...]` in `lib.rs`; argument names in `invoke` must match the Rust parameter names (camelCase on the JS side maps to snake_case in Rust). Every command is `async` and does its work inside the `blocking()` helper in `src/library/commands.rs` (`spawn_blocking`), so neither the main thread nor async workers wait on the DB lock or the file system.
  - **Database** (`src/db.rs`): one `rusqlite` connection (bundled SQLite) in managed state as `Db(Mutex<Connection>)`, stored at `<app data dir>/blockbuster.db` (`~/.local/share/com.jintudas.blockbuster/` on Linux). Migrations are a `MIGRATIONS` array applied by `PRAGMA user_version`: only append, never edit a shipped entry.
  - **Library** (`src/library/`): `scanner.rs` walks the folder (videos only, hidden entries skipped, no symlinks), `title.rs` derives title and year from the file name (`RELEASE_TAGS` end a title, word-like `TRAILING_TAGS` are only trimmed from its end), `catalog.rs` diffs a scan against the `movies` table (insert, update, mark `missing`; rows are never deleted so progress survives; a size change means a different file and clears duration/progress, a modification-time-only change keeps them; movies at or under unreadable paths are left alone; rows from a previous library folder are hidden but not counted as missing), `commands.rs` exposes `get_library_folder`, `set_library_folder`, `scan_library`, `list_movies`. Scans hold `ScanLock` for their whole run, and the folder setting plus scan results are written in one transaction, so a failed scan never changes the saved folder. Each Rust module carries its own `#[cfg(test)]` tests; DB tests use `db::open_in_memory()`.
  - Media files are read-only; generated data (DB, future thumbnails) goes in the app data directory.
- **Permissions**: Tauri 2 denies plugin APIs by default. Adding a plugin means adding it in `Cargo.toml`, calling `.plugin(...)` in `lib.rs`, installing the JS package, and granting its permissions in `src-tauri/capabilities/default.json` (currently `dialog:allow-open` for the folder picker).
- **Planned components** (per README): FFmpeg/ffprobe for durations and thumbnails (columns `duration_seconds` already exist), and mpv controlled over its JSON IPC socket for playback and resume (`progress_seconds`, `last_played_at`).
- `src-tauri/gen/` is generated by the Tauri build; do not edit it by hand.
