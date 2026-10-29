import { LibraryEmptyState, LibraryLoadError, MovieGridSkeleton, useLibraryMovies } from "@/features/library";
import { MOVIE_VIEWS } from "@/features/movies";
import { useHomeSections } from "../hooks/use-home-sections";
import { HomeBillboard } from "./home-billboard";
import { LibraryStats } from "./library-stats";
import { MovieShelf } from "./movie-shelf";

export function HomePage() {
  const { movies, isLoading, error, refetch } = useLibraryMovies();
  const home = useHomeSections(movies);

  if (error) return <LibraryLoadError error={error} onRetry={refetch} />;
  if (isLoading) return <MovieGridSkeleton />;
  if (movies.length === 0) return <LibraryEmptyState />;

  return (
    <div className="flex flex-col gap-8">
      <HomeBillboard items={home.billboard} />

      <MovieShelf
        title="Continue watching"
        description="More in progress"
        movies={home.inProgress}
        viewAll={{ to: "/movies", search: MOVIE_VIEWS.continueWatching }}
      />
      <MovieShelf
        title="Recently added"
        movies={home.recentlyAdded}
        viewAll={{ to: "/movies", search: MOVIE_VIEWS.recentlyAdded }}
      />
      <MovieShelf
        title="Something new to watch"
        description="Not played yet"
        movies={home.unwatched}
        viewAll={{ to: "/movies", search: MOVIE_VIEWS.unwatched }}
      />
      <MovieShelf
        title="In 4K"
        movies={home.fourK}
        viewAll={{ to: "/movies", search: MOVIE_VIEWS.fourK }}
      />
      {home.topDecade !== undefined && (
        <MovieShelf
          title={`From the ${home.topDecade}s`}
          movies={home.fromTopDecade}
          viewAll={{ to: "/movies", search: MOVIE_VIEWS.decade(home.topDecade) }}
        />
      )}
      <MovieShelf
        title="Watch again"
        description="Played longest ago"
        movies={home.watchAgain}
        viewAll={{ to: "/movies", search: MOVIE_VIEWS.watchAgain }}
      />

      <LibraryStats movies={movies} />
    </div>
  );
}
