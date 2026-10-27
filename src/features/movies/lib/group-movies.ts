import type { Movie } from "@/features/library";
import type { GroupKey } from "../types";
import { decadeOf, resolutionOf, watchStatusOf } from "./apply-movie-filters";
import { RESOLUTIONS, STATUS_OPTIONS } from "./movie-filters";

export type MovieGroup = { key: string; label: string; movies: Movie[] };

const labelOrder = new Intl.Collator(undefined, { sensitivity: "base", numeric: true });

/** The folder a movie sits in, relative to the library folder ("" for the library folder itself). */
export function folderOf(movie: Movie, libraryFolder: string | null | undefined) {
  const directory = movie.filePath.slice(0, movie.filePath.lastIndexOf("/"));
  if (libraryFolder && (directory === libraryFolder || directory.startsWith(`${libraryFolder}/`))) {
    return directory.slice(libraryFolder.length + 1);
  }
  return directory;
}

type Grouping = {
  keyOf: (movie: Movie) => string;
  labelOf: (key: string) => string;
  /** Order of group keys; groups not listed follow, sorted by label. */
  compare: (a: string, b: string) => number;
};

function fixedOrder(keys: string[]) {
  return (a: string, b: string) => {
    const rank = (key: string) => (keys.includes(key) ? keys.indexOf(key) : keys.length);
    return rank(a) - rank(b);
  };
}

function groupings(libraryFolder: string | null | undefined): Record<GroupKey, Grouping> {
  return {
    letter: {
      // Leading "The" and "A" count, as in most file managers; digits and symbols share "#".
      keyOf: (movie) => {
        const first = movie.title.trim().charAt(0).toUpperCase();
        return /\p{L}/u.test(first) ? first : "#";
      },
      labelOf: (key) => key,
      compare: (a, b) => (a === "#" ? 1 : b === "#" ? -1 : labelOrder.compare(a, b)),
    },
    decade: {
      keyOf: (movie) => (movie.year !== undefined ? String(decadeOf(movie.year)) : "unknown"),
      labelOf: (key) => (key === "unknown" ? "Unknown year" : `${key}s`),
      compare: (a, b) => (a === "unknown" ? 1 : b === "unknown" ? -1 : Number(b) - Number(a)),
    },
    quality: {
      keyOf: (movie) => resolutionOf(movie) ?? "unknown",
      labelOf: (key) => (key === "unknown" ? "Not probed yet" : key),
      compare: fixedOrder([...RESOLUTIONS, "unknown"]),
    },
    status: {
      keyOf: watchStatusOf,
      labelOf: (key) => STATUS_OPTIONS.find((option) => option.value === key)?.label ?? key,
      compare: fixedOrder(["in-progress", "unwatched", "watched"]),
    },
    folder: {
      keyOf: (movie) => folderOf(movie, libraryFolder),
      labelOf: (key) => key || "Library folder",
      compare: (a, b) => (a === "" ? -1 : b === "" ? 1 : labelOrder.compare(a, b)),
    },
  };
}

/** Splits already sorted movies into ordered groups; each group keeps the incoming order. */
export function groupMovies(movies: Movie[], group: GroupKey, libraryFolder: string | null | undefined): MovieGroup[] {
  const { keyOf, labelOf, compare } = groupings(libraryFolder)[group];
  const byKey = new Map<string, Movie[]>();
  for (const movie of movies) {
    const key = keyOf(movie);
    byKey.set(key, [...(byKey.get(key) ?? []), movie]);
  }
  return [...byKey.entries()]
    .map(([key, groupMovies]) => ({ key, label: labelOf(key), movies: groupMovies }))
    .sort((a, b) => compare(a.key, b.key) || labelOrder.compare(a.label, b.label));
}
