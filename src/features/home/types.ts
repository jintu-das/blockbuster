import type { Movie } from "@/features/library";

export type BillboardItem = { movie: Movie; eyebrow: string };

/** Everything the Home page shows, built from the catalog by `buildHomeSections`. */
export type HomeSections = {
  billboard: BillboardItem[];
  inProgress: Movie[];
  recentlyAdded: Movie[];
  unwatched: Movie[];
  fourK: Movie[];
  /** The decade with the most movies, if any movie has a year. */
  topDecade?: number;
  fromTopDecade: Movie[];
  watchAgain: Movie[];
};
