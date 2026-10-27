import { useMemo, useState } from "react";
import {
  LibraryEmptyState,
  LibraryLoadError,
  MovieGridSkeleton,
  useLibraryMovies,
  type Movie,
} from "@/features/library";
import { decadeOf, resolutionOf, sortMovies, watchStatusOf, type WatchStatus } from "@/features/movies";
import { seededOrder } from "../lib/seeded-order";
import { HomeBillboard, type BillboardItem } from "./home-billboard";
import { LibraryStats } from "./library-stats";
import { MovieShelf } from "./movie-shelf";

const SHELF_LIMIT = 20;
const BILLBOARD_LIMIT = 5;

export function HomePage() {
  const { movies, isLoading, error, refetch } = useLibraryMovies();
  // One seed per visit: picks look random but stay put when a rescan refetches the catalog.
  const [seed] = useState(Math.random);

  const home = useMemo(() => {
    // One pass over the catalog; this reruns on every refetch, which can come every few
    // seconds while the metadata pass runs.
    const byStatus: Record<WatchStatus, Movie[]> = { "in-progress": [], unwatched: [], watched: [] };
    const fourK: Movie[] = [];
    const byDecade = new Map<number, Movie[]>();
    for (const movie of movies) {
      byStatus[watchStatusOf(movie)].push(movie);
      if (resolutionOf(movie) === "4K") fourK.push(movie);
      if (movie.year !== undefined) {
        const decade = decadeOf(movie.year);
        const decadeMovies = byDecade.get(decade);
        if (decadeMovies) decadeMovies.push(movie);
        else byDecade.set(decade, [movie]);
      }
    }

    const inProgress = sortMovies(byStatus["in-progress"], "played");
    const unwatched = seededOrder(byStatus.unwatched, seed, "unwatched");
    // The latest movie in progress leads the billboard; the rest of them fill the shelf below,
    // so no title shows twice at the top of the page.
    const [resume, ...stillInProgress] = inProgress;
    const picks = BILLBOARD_LIMIT - (resume ? 1 : 0);
    const billboard: BillboardItem[] = [
      ...(resume ? [{ movie: resume, eyebrow: "Continue watching" }] : []),
      ...unwatched.slice(0, picks).map((movie) => ({ movie, eyebrow: "Pick for tonight" })),
    ];
    // The decade with the most movies (the newer one on a tie) gets its own shelf.
    const [topDecade, fromTopDecade = []] =
      [...byDecade.entries()].sort((a, b) => b[1].length - a[1].length || b[0] - a[0])[0] ?? [];

    return {
      billboard,
      inProgress: stillInProgress.slice(0, SHELF_LIMIT),
      recentlyAdded: sortMovies(movies, "added").slice(0, SHELF_LIMIT),
      // Unwatched movies not already featured in the billboard.
      unwatched: unwatched.slice(picks, picks + SHELF_LIMIT),
      fourK: seededOrder(fourK, seed, "4k").slice(0, SHELF_LIMIT),
      topDecade,
      fromTopDecade: seededOrder(fromTopDecade, seed, "decade").slice(0, SHELF_LIMIT),
      watchAgain: sortMovies(byStatus.watched, "played-oldest").slice(0, SHELF_LIMIT),
    };
  }, [movies, seed]);

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
        viewAll={{ to: "/movies", search: { status: "in-progress", sort: "played" } }}
      />
      <MovieShelf
        title="Recently added"
        movies={home.recentlyAdded}
        viewAll={{ to: "/movies", search: { sort: "added" } }}
      />
      <MovieShelf
        title="Something new to watch"
        description="Not played yet"
        movies={home.unwatched}
        viewAll={{ to: "/movies", search: { status: "unwatched" } }}
      />
      <MovieShelf
        title="In 4K"
        movies={home.fourK}
        viewAll={{ to: "/movies", search: { quality: ["4K"] } }}
      />
      {home.topDecade !== undefined && (
        <MovieShelf
          title={`From the ${home.topDecade}s`}
          movies={home.fromTopDecade}
          viewAll={{ to: "/movies", search: { decade: home.topDecade } }}
        />
      )}
      <MovieShelf
        title="Watch again"
        description="Played longest ago"
        movies={home.watchAgain}
        viewAll={{ to: "/movies", search: { status: "watched", sort: "played-oldest" } }}
      />

      <LibraryStats movies={movies} />
    </div>
  );
}
