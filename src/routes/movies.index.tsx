import { createFileRoute } from "@tanstack/react-router";
import { MoviesPage, parseMovieFilters, type MovieFilters } from "@/features/movies";

export const Route = createFileRoute("/movies/")({
  validateSearch: parseMovieFilters,
  component: MoviesRoute,
});

function MoviesRoute() {
  const filters = Route.useSearch();
  const navigate = Route.useNavigate();
  // `replace`, so typing a search doesn't add a history entry per keystroke.
  const setFilters = (next: MovieFilters) => navigate({ search: next, replace: true });
  return <MoviesPage filters={filters} onFiltersChange={setFilters} />;
}
