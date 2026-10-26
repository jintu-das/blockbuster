import { useLibraryMovies } from "../hooks/use-library-movies";
import { LibraryEmptyState } from "./library-empty-state";
import { MovieGrid } from "./movie-grid";

export function LibraryPage() {
  const movies = useLibraryMovies();

  return (
    <div className="flex flex-1 flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="font-heading text-2xl font-semibold">Library Catalog</h1>
        <p className="text-sm text-muted-foreground">
          Browse your enitr local media vault
        </p>
      </div>
      {movies.length > 0 ? (
        <MovieGrid movies={movies} />
      ) : (
        <LibraryEmptyState />
      )}
    </div>
  );
}
