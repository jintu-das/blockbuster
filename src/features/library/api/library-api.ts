import { invoke } from "@tauri-apps/api/core";
import type { Movie, ScanSummary } from "../types";

/** Shape returned by the `list_movies` command (timestamps in Unix seconds). */
type MovieDto = {
  id: number;
  path: string;
  title: string;
  year: number | null;
  sizeBytes: number;
  modifiedAt: number;
  addedAt: number;
  durationSeconds: number | null;
  progressSeconds: number | null;
  lastPlayedAt: number | null;
};

function toIso(unixSeconds: number) {
  return new Date(unixSeconds * 1000).toISOString();
}

function toMovie(dto: MovieDto): Movie {
  const { durationSeconds, progressSeconds } = dto;
  return {
    id: String(dto.id),
    title: dto.title,
    year: dto.year ?? undefined,
    durationMinutes: durationSeconds !== null ? Math.round(durationSeconds / 60) : undefined,
    sizeBytes: dto.sizeBytes,
    filePath: dto.path,
    addedAt: toIso(dto.addedAt),
    lastPlayedAt: dto.lastPlayedAt !== null ? toIso(dto.lastPlayedAt) : undefined,
    progress: progressSeconds !== null && durationSeconds ? progressSeconds / durationSeconds : undefined,
  };
}

export const libraryApi = {
  getFolder: () => invoke<string | null>("get_library_folder"),
  setFolder: (path: string) => invoke<ScanSummary>("set_library_folder", { path }),
  scan: () => invoke<ScanSummary>("scan_library"),
  listMovies: async () => (await invoke<MovieDto[]>("list_movies")).map(toMovie),
  play: (id: string, fromStart: boolean) => invoke<void>("play_movie", { movieId: Number(id), fromStart }),
};

/** Kept outside `libraryKeys.all`, so starting playback never marks scans as busy. */
export const playerKeys = {
  play: ["player", "play"] as const,
};

/** Emitted by the backend once a playback session has saved its final position. */
export const PLAYBACK_ENDED_EVENT = "playback-ended";

export const libraryKeys = {
  all: ["library"] as const,
  folder: ["library", "folder"] as const,
  movies: ["library", "movies"] as const,
  // Mutation keys share the `library` prefix so `useLibraryBusy` sees every scan.
  scan: ["library", "scan"] as const,
  setFolder: ["library", "set-folder"] as const,
};
