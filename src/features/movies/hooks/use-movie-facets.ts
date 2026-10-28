import { useMemo } from "react";
import type { Movie } from "@/features/library";
import { catalogDecades, catalogGenres } from "../lib/movie-facets";

/** Filter menu options, built from the whole catalog so they don't shrink as filters narrow it. */
export function useMovieFacets(movies: Movie[]) {
  const decades = useMemo(() => catalogDecades(movies), [movies]);
  const genres = useMemo(() => catalogGenres(movies), [movies]);
  return { decades, genres };
}
