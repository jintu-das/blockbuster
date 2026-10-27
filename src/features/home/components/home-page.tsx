import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRightIcon } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import {
  LibraryEmptyState,
  LibraryLoadError,
  MovieGridSkeleton,
  useLibraryMovies,
} from "@/features/library";
import { seededOrder } from "../lib/seeded-order";
import { ContinueWatchingHero } from "./continue-watching-hero";
import { LibraryStats } from "./library-stats";
import { MovieSection } from "./movie-section";

const SECTION_LIMIT = 10;

export function HomePage() {
  const { movies, isLoading, error, refetch } = useLibraryMovies();
  // One seed per visit: sections look random but stay put when a rescan refetches the catalog.
  const [seed] = useState(Math.random);

  const sections = useMemo(
    () => ({
      resume: seededOrder(movies.filter((movie) => (movie.progress ?? 0) > 0), seed, "resume")[0],
      recentlyAdded: seededOrder(movies, seed, "recent").slice(0, SECTION_LIMIT),
      watchlist: seededOrder(movies, seed, "watchlist").slice(0, SECTION_LIMIT),
      favorites: seededOrder(movies, seed, "favorites").slice(0, SECTION_LIMIT),
    }),
    [movies, seed],
  );

  if (error) {
    return <LibraryLoadError error={error} onRetry={refetch} />;
  }
  if (isLoading) {
    return <MovieGridSkeleton />;
  }
  if (movies.length === 0) {
    return <LibraryEmptyState />;
  }

  return (
    <div className="flex flex-col gap-10">
      {sections.resume && <ContinueWatchingHero movie={sections.resume} />}

      <MovieSection
        title="Recently added"
        movies={sections.recentlyAdded}
        action={
          <Link
            to="/movies"
            className={buttonVariants({ variant: "ghost", size: "sm" })}
          >
            View all
            <ArrowRightIcon data-icon="inline-end" />
          </Link>
        }
      />

      <MovieSection title="Your watchlist" movies={sections.watchlist} />

      <MovieSection
        title="Favorites & highest rated"
        movies={sections.favorites}
        showRating
      />

      <LibraryStats movies={movies} />
    </div>
  );
}
