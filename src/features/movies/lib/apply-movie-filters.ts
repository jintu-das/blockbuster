import type { Movie } from "@/features/library";
import { DEFAULT_SORT } from "./movie-filters";
import type { MovieFilters, Resolution, SortKey, WatchStatus } from "../types";

const titleOrder = new Intl.Collator(undefined, { sensitivity: "base", numeric: true });

/** In progress while a position is saved; watched once played and the position was cleared. */
export function watchStatusOf(movie: Movie): WatchStatus {
  if ((movie.progress ?? 0) > 0) return "in-progress";
  return movie.lastPlayedAt ? "watched" : "unwatched";
}

export function resolutionOf(movie: Movie) {
  return movie.quality?.split(" ")[0] as Resolution | undefined;
}

export function isHdr(movie: Movie) {
  return movie.quality?.includes("HDR") ?? false;
}

export function decadeOf(year: number) {
  return Math.floor(year / 10) * 10;
}

function matches(movie: Movie, filters: MovieFilters, query: string) {
  if (query && !movie.title.toLowerCase().includes(query)) return false;
  if (filters.status && watchStatusOf(movie) !== filters.status) return false;
  if (filters.quality?.length) {
    const resolution = resolutionOf(movie);
    if (!resolution || !filters.quality.includes(resolution)) return false;
  }
  if (filters.hdr && !isHdr(movie)) return false;
  if (filters.decade !== undefined && (movie.year === undefined || decadeOf(movie.year) !== filters.decade)) {
    return false;
  }
  return true;
}

// Newest or largest first; movies missing the value go last, then by title.
const comparators: Record<SortKey, (a: Movie, b: Movie) => number> = {
  added: (a, b) => b.addedAt.localeCompare(a.addedAt),
  played: (a, b) => (b.lastPlayedAt ?? "").localeCompare(a.lastPlayedAt ?? ""),
  title: () => 0,
  year: (a, b) => (b.year ?? -Infinity) - (a.year ?? -Infinity),
  size: (a, b) => b.sizeBytes - a.sizeBytes,
};

export function sortMovies(movies: Movie[], sort: SortKey = DEFAULT_SORT) {
  const compare = comparators[sort];
  return [...movies].sort((a, b) => compare(a, b) || titleOrder.compare(a.title, b.title));
}

export function applyMovieFilters(movies: Movie[], filters: MovieFilters) {
  const query = filters.q?.trim().toLowerCase() ?? "";
  return sortMovies(
    movies.filter((movie) => matches(movie, filters, query)),
    filters.sort,
  );
}
