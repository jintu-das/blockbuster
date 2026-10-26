import type { Movie } from "../types";
import { MovieCard } from "./movie-card";

export function MovieGrid({ movies, showRating = false }: { movies: Movie[]; showRating?: boolean }) {
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(11rem,1fr))] gap-x-4 gap-y-6">
      {movies.map((movie) => (
        <MovieCard key={movie.id} movie={movie} showRating={showRating} />
      ))}
    </div>
  );
}
