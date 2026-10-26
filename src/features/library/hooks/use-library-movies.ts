import { useQuery } from "@tanstack/react-query";
import { libraryApi, libraryKeys } from "../api/library-api";
import type { Movie } from "../types";

// Stable fallback so consumers that memoize on `movies` don't recompute while loading.
const NO_MOVIES: Movie[] = [];

export function useLibraryMovies() {
  const query = useQuery({ queryKey: libraryKeys.movies, queryFn: libraryApi.listMovies });
  return {
    movies: query.data ?? NO_MOVIES,
    isLoading: query.isPending,
    error: query.error,
    refetch: () => void query.refetch(),
  };
}
