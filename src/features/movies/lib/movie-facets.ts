import type { Movie } from "@/features/library";
import { decadeOf } from "./apply-movie-filters";
import type { GenreOption } from "../types";

/** Decades that have at least one movie, newest first. */
export function catalogDecades(movies: Movie[]) {
  return [...new Set(movies.flatMap((movie) => (movie.year !== undefined ? [decadeOf(movie.year)] : [])))].sort(
    (a, b) => b - a,
  );
}

/** Genres that have at least one movie, A–Z, with how many movies each has. */
export function catalogGenres(movies: Movie[]): GenreOption[] {
  const counts = new Map<string, number>();
  for (const genre of movies.flatMap((movie) => movie.genres)) counts.set(genre, (counts.get(genre) ?? 0) + 1);
  return [...counts].sort(([a], [b]) => a.localeCompare(b)).map(([name, count]) => ({ name, count }));
}
