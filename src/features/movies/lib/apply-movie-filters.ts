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
  if (filters.genre?.length && !movie.genres.some((genre) => filters.genre?.includes(genre))) return false;
  return true;
}

/** Earliest play first; never-played movies go last. */
function playedOldestFirst(a: Movie, b: Movie) {
  if (!a.lastPlayedAt || !b.lastPlayedAt) return (a.lastPlayedAt ? -1 : 0) + (b.lastPlayedAt ? 1 : 0);
  return a.lastPlayedAt.localeCompare(b.lastPlayedAt);
}

// Newest or largest first (except "played-oldest"); movies missing the value go last, then by title.
const comparators: Record<SortKey, (a: Movie, b: Movie) => number> = {
  added: (a, b) => b.addedAt.localeCompare(a.addedAt),
  played: (a, b) => (b.lastPlayedAt ?? "").localeCompare(a.lastPlayedAt ?? ""),
  "played-oldest": playedOldestFirst,
  title: () => 0,
  year: (a, b) => (b.year ?? -Infinity) - (a.year ?? -Infinity),
  size: (a, b) => b.sizeBytes - a.sizeBytes,
};

function comparatorFor(sort: SortKey) {
  const compare = comparators[sort];
  return (a: Movie, b: Movie) => compare(a, b) || titleOrder.compare(a.title, b.title);
}

export function sortMovies(movies: Movie[], sort: SortKey = DEFAULT_SORT) {
  return [...movies].sort(comparatorFor(sort));
}

/**
 * The first `limit` movies of `sortMovies(movies, sort)`, without sorting the whole list: Home
 * rebuilds its shelves on every catalog refetch and only shows a few movies per shelf.
 */
export function topMovies(movies: Movie[], sort: SortKey, limit: number) {
  const compare = comparatorFor(sort);
  const top: Movie[] = [];
  for (const movie of movies) {
    if (top.length === limit && (limit === 0 || compare(movie, top[limit - 1]) >= 0)) continue;
    // Insert after equal movies, so ties keep catalog order as the stable sort does.
    let low = 0;
    let high = top.length;
    while (low < high) {
      const middle = (low + high) >> 1;
      if (compare(movie, top[middle]) < 0) high = middle;
      else low = middle + 1;
    }
    top.splice(low, 0, movie);
    if (top.length > limit) top.pop();
  }
  return top;
}

/** How many movies `filters` would show, without sorting them. */
export function countMovies(movies: Movie[], filters: MovieFilters) {
  const query = filters.q?.trim().toLowerCase() ?? "";
  return movies.reduce((count, movie) => count + (matches(movie, filters, query) ? 1 : 0), 0);
}

export function applyMovieFilters(movies: Movie[], filters: MovieFilters) {
  const query = filters.q?.trim().toLowerCase() ?? "";
  return sortMovies(
    movies.filter((movie) => matches(movie, filters, query)),
    filters.sort,
  );
}
