import { useLibraryMovies } from "../hooks/use-library-movies";
import { formatMovieCount } from "../lib/format-movie-count";
import { LibraryEmptyState } from "./library-empty-state";
import { MovieGrid } from "./movie-grid";

export function LibrariesPage() {
  const movies = useLibraryMovies();

  return (
    <div className="flex flex-1 flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="font-heading text-2xl font-semibold">Libraries</h1>
        {movies.length > 0 && (
          <p className="text-sm text-muted-foreground">{formatMovieCount(movies.length)}</p>
        )}
      </div>
      {movies.length > 0 ? <MovieGrid movies={movies} /> : <LibraryEmptyState />}
    </div>
  );
}
