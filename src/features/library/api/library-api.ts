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
  quality: string | null;
  /** File name of the generated poster or frame; load it with `get_thumbnail`. */
  thumbnailFile: string | null;
  /** OMDb's comma-separated genres, e.g. "Action, Sci-Fi"; "N/A" or null when unknown. */
  genre: string | null;
};

function toIso(unixSeconds: number) {
  return new Date(unixSeconds * 1000).toISOString();
}

/** OMDb's "Action, Sci-Fi" as a list, tolerating missing spaces and repeats. */
function toGenres(genre: string | null) {
  if (!genre || genre === "N/A") return [];
  return [...new Set(genre.split(",").map((name) => name.trim()).filter(Boolean))];
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
    progressSeconds: progressSeconds ?? undefined,
    quality: dto.quality ?? undefined,
    thumbnailFile: dto.thumbnailFile ?? undefined,
    genres: toGenres(dto.genre),
  };
}

function toDataUrl(bytes: ArrayBuffer) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(new Blob([bytes], { type: "image/jpeg" }));
  });
}

export const libraryApi = {
  getFolder: () => invoke<string | null>("get_library_folder"),
  setFolder: (path: string) => invoke<ScanSummary>("set_library_folder", { path }),
  scan: () => invoke<ScanSummary>("scan_library"),
  listMovies: async () => (await invoke<MovieDto[]>("list_movies")).map(toMovie),
  /** JPEG bytes, as a data URL so the query cache can hold it without leaking object URLs. */
  thumbnail: async (id: string) => toDataUrl(await invoke<ArrayBuffer>("get_thumbnail", { movieId: Number(id) })),
  artwork: async (id: string) => toDataUrl(await invoke<ArrayBuffer>("get_artwork", { movieId: Number(id) })),
  play: (id: string, fromStart: boolean) => invoke<void>("play_movie", { movieId: Number(id), fromStart }),
};

/**
 * Kept outside `libraryKeys.all`, so catalog invalidations never reload images. The file name is
 * part of the key: a poster replacing a frame gets a new name and so a fresh load.
 */
export const thumbnailKeys = {
  of: (id: string, file: string | undefined) => ["thumbnail", id, file] as const,
  artwork: (id: string, file: string | undefined) => ["thumbnail", id, file, "artwork"] as const,
};

/** Kept outside `libraryKeys.all`, so starting playback never marks scans as busy. */
export const playerKeys = {
  play: ["player", "play"] as const,
};

/** Emitted by the backend once a playback session has saved its final position. */
export const PLAYBACK_ENDED_EVENT = "playback-ended";

/** Emitted by the backend as the metadata pass fills in qualities, durations and thumbnails. */
export const LIBRARY_UPDATED_EVENT = "library-updated";

export const libraryKeys = {
  all: ["library"] as const,
  folder: ["library", "folder"] as const,
  movies: ["library", "movies"] as const,
  // Mutation keys share the `library` prefix so `useLibraryBusy` sees every scan.
  scan: ["library", "scan"] as const,
  setFolder: ["library", "set-folder"] as const,
};
