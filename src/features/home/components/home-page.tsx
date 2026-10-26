import { useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRightIcon } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { LibraryEmptyState, useLibraryMovies } from "@/features/library";
import { shuffle } from "../lib/shuffle";
import { ContinueWatchingHero } from "./continue-watching-hero";
import { LibraryStats } from "./library-stats";
import { MovieSection } from "./movie-section";

const SECTION_LIMIT = 10;

export function HomePage() {
  const movies = useLibraryMovies();

  // Placeholder ordering: each section gets its own random pick, fixed for the life of the page.
  const sections = useMemo(
    () => ({
      resume: shuffle(movies.filter((movie) => (movie.progress ?? 0) > 0))[0],
      recentlyAdded: shuffle(movies).slice(0, SECTION_LIMIT),
      watchlist: shuffle(movies).slice(0, SECTION_LIMIT),
      favorites: shuffle(movies).slice(0, SECTION_LIMIT),
    }),
    [movies],
  );

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
            to="/library"
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
