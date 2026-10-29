import { useNavigate, useSearch } from "@tanstack/react-router";
import { useOnMoviesPage } from "./use-on-movies-page";

export function useMovieSearch() {
  const navigate = useNavigate();
  const onMoviesPage = useOnMoviesPage();
  const q = useSearch({
    strict: false,
    select: (search) => ("q" in search ? search.q : undefined),
  });

  const search = (next: string) =>
    navigate({
      to: "/movies",
      search: (previous) => ({
        ...(onMoviesPage ? previous : {}),
        q: next || undefined,
      }),
      replace: onMoviesPage,
    });

  // Other pages show an empty box: their URL may carry a stale `q` from an earlier visit.
  return { query: onMoviesPage ? (q ?? "") : "", search };
}
