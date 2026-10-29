import type { Movie } from "@/features/library";
import { decadeOf, resolutionOf, topMovies, watchStatusOf, type WatchStatus } from "@/features/movies";
import type { BillboardItem, HomeSections } from "../types";
import { seededOrder } from "./seeded-order";

const SHELF_LIMIT = 20;
/** Unwatched picks on the billboard, after the movie to resume (if any). Fixed, so starting or
 * finishing a movie never moves a pick between the billboard and the unwatched shelf. */
const BILLBOARD_PICKS = 4;

const shelf = (movies: Movie[]) => movies.slice(0, SHELF_LIMIT);

/** The billboard and shelves for the Home page; `seed` fixes the order of random picks. */
export function buildHomeSections(movies: Movie[], seed: number): HomeSections {
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

  const unwatched = seededOrder(byStatus.unwatched, seed, "unwatched");
  // The latest movie in progress leads the billboard; the rest of them fill the shelf below,
  // so no title shows twice at the top of the page.
  const [resume, ...stillInProgress] = topMovies(byStatus["in-progress"], "played", SHELF_LIMIT + 1);
  const billboard: BillboardItem[] = [
    ...(resume ? [{ movie: resume, eyebrow: "Continue watching" }] : []),
    ...unwatched.slice(0, BILLBOARD_PICKS).map((movie) => ({ movie, eyebrow: "Pick for tonight" })),
  ];
  // The decade with the most movies (the newer one on a tie) gets its own shelf.
  const [topDecade, fromTopDecade = []] =
    [...byDecade.entries()].sort((a, b) => b[1].length - a[1].length || b[0] - a[0])[0] ?? [];

  return {
    billboard,
    inProgress: stillInProgress,
    recentlyAdded: topMovies(movies, "added", SHELF_LIMIT),
    // Unwatched movies not already featured in the billboard.
    unwatched: shelf(unwatched.slice(BILLBOARD_PICKS)),
    fourK: shelf(seededOrder(fourK, seed, "4k")),
    topDecade,
    fromTopDecade: shelf(seededOrder(fromTopDecade, seed, "decade")),
    watchAgain: topMovies(byStatus.watched, "played-oldest", SHELF_LIMIT),
  };
}
