import { useMatchRoute } from "@tanstack/react-router";

/** Whether the Movies list itself is open (not a movie's details page under it). */
export function useOnMoviesPage() {
  const matchRoute = useMatchRoute();
  return Boolean(matchRoute({ to: "/movies", includeSearch: false }));
}
