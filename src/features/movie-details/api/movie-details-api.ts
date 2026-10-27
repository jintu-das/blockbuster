import { invoke } from "@tauri-apps/api/core";
import { libraryKeys } from "@/features/library";
import type { MediaInfo, OmdbMetadata } from "../types";
import { toOmdbMetadata, type OmdbMovieDto } from "./omdb-movie";

/** Shape returned by the `get_movie_details` command: stored JSON text, or null until the pass fills it. */
type MovieDetailsDto = {
  omdbJson: string | null;
  omdbLookedUp: boolean;
  omdbEnabled: boolean;
  mediaJson: string | null;
};

/** Why a movie has no OMDb details, so the page can say so honestly. */
export type OmdbStatus = "found" | "no-key" | "pending" | "not-found";

export type StoredDetails = {
  omdb?: OmdbMetadata;
  omdbStatus: OmdbStatus;
  media?: MediaInfo;
};

function omdbStatus(dto: MovieDetailsDto, omdb: OmdbMovieDto | undefined): OmdbStatus {
  if (omdb) return "found";
  if (!dto.omdbEnabled) return "no-key";
  return dto.omdbLookedUp ? "not-found" : "pending";
}

function parse<T>(json: string | null): T | undefined {
  if (json === null) return undefined;
  try {
    return JSON.parse(json) as T;
  } catch {
    return undefined;
  }
}

export const movieDetailsApi = {
  /** `null` when the movie is not in the catalog (or its file is missing). */
  get: async (id: string): Promise<StoredDetails | null> => {
    const dto = await invoke<MovieDetailsDto | null>("get_movie_details", { movieId: Number(id) });
    if (!dto) return null;
    const omdb = parse<OmdbMovieDto>(dto.omdbJson);
    return {
      omdb: omdb && toOmdbMetadata(omdb),
      omdbStatus: omdbStatus(dto, omdb),
      media: parse<MediaInfo>(dto.mediaJson),
    };
  },
};

/**
 * Under `libraryKeys.movies`, so `useCatalogSync` refetches details whenever it refetches the
 * catalog (the metadata pass storing a reply, playback ending) and library mutations do too.
 */
export const movieDetailsKeys = {
  of: (id: string) => [...libraryKeys.movies, id, "details"] as const,
};
