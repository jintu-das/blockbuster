import { useMemo } from "react";
import type { Movie } from "@/features/library";
import { applyMovieFilters } from "../lib/apply-movie-filters";
import { groupMovies } from "../lib/group-movies";
import type { MovieFilters } from "../types";

/** The movies matching `filters`, sorted, grouped when a grouping is set, and their total size. */
export function useFilteredMovies(movies: Movie[], filters: MovieFilters, libraryFolder: string | null | undefined) {
  // Keyed on the narrowing and sort fields only: the router hands over a new `filters` object (and
  // new arrays) on every URL change, and switching view or grouping must not re-filter the catalog.
  const { view: _view, group: _group, ...narrowing } = filters;
  const narrowingKey = JSON.stringify(narrowing);
  const results = useMemo(() => applyMovieFilters(movies, narrowing), [movies, narrowingKey]);
  const groups = useMemo(
    () => (filters.group ? groupMovies(results, filters.group, libraryFolder) : undefined),
    [results, filters.group, libraryFolder],
  );
  const totalBytes = useMemo(() => results.reduce((sum, movie) => sum + movie.sizeBytes, 0), [results]);
  return { results, groups, totalBytes };
}
