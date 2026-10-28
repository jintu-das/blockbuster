import type { GroupKey, MovieFilters, Resolution, SortKey, WatchStatus } from "../types";

export const STATUS_OPTIONS: { value: WatchStatus | undefined; label: string }[] = [
  { value: undefined, label: "All" },
  { value: "unwatched", label: "Unwatched" },
  { value: "in-progress", label: "In progress" },
  { value: "watched", label: "Watched" },
];

export const RESOLUTIONS: Resolution[] = ["4K", "1080p", "720p", "SD"];

export const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "title", label: "Title A–Z" },
  { value: "added", label: "Recently added" },
  { value: "played", label: "Recently played" },
  { value: "played-oldest", label: "Played longest ago" },
  { value: "year", label: "Release year" },
  { value: "size", label: "File size" },
];

export const DEFAULT_SORT: SortKey = "title";

/** Preset Movies views shared by the Home shelves' "View all" links and the sidebar quick views. */
export const MOVIE_VIEWS = {
  continueWatching: { status: "in-progress", sort: "played" },
  recentlyAdded: { sort: "added" },
  unwatched: { status: "unwatched" },
  fourK: { quality: ["4K"] },
  watchAgain: { status: "watched", sort: "played-oldest" },
} satisfies Record<string, MovieFilters>;

export const GROUP_OPTIONS: { value: GroupKey | undefined; label: string }[] = [
  { value: undefined, label: "No grouping" },
  { value: "letter", label: "Title A–Z" },
  { value: "decade", label: "Decade" },
  { value: "quality", label: "Quality" },
  { value: "status", label: "Watch status" },
  { value: "folder", label: "Folder" },
];

function oneOf<T extends string>(value: unknown, options: readonly T[]): T | undefined {
  return options.includes(value as T) ? (value as T) : undefined;
}

/** Reads filters from the URL, dropping anything unknown or malformed (e.g. a hand-edited link). */
export function parseMovieFilters(search: Record<string, unknown>): MovieFilters {
  const quality = Array.isArray(search.quality)
    ? search.quality.filter((value): value is Resolution => oneOf(value, RESOLUTIONS) !== undefined)
    : [];
  const genre = Array.isArray(search.genre)
    ? search.genre.filter((value): value is string => typeof value === "string")
    : [];
  const decade = Number(search.decade);
  return cleanFilters({
    q: typeof search.q === "string" ? search.q : undefined,
    status: oneOf(search.status, ["unwatched", "in-progress", "watched"]),
    quality,
    hdr: search.hdr === true || undefined,
    decade: Number.isInteger(decade) && decade % 10 === 0 ? decade : undefined,
    genre,
    sort: oneOf(search.sort, SORT_OPTIONS.map((option) => option.value)),
    group: oneOf(search.group, ["letter", "decade", "quality", "status", "folder"]),
    view: oneOf(search.view, ["grid", "list"]),
  });
}

/** Drops empty and default values, so the URL only carries what narrows the list. */
export function cleanFilters(filters: MovieFilters): MovieFilters {
  return {
    q: filters.q || undefined,
    status: filters.status,
    quality: filters.quality?.length ? filters.quality : undefined,
    hdr: filters.hdr || undefined,
    decade: filters.decade,
    genre: filters.genre?.length ? filters.genre : undefined,
    sort: filters.sort === DEFAULT_SORT ? undefined : filters.sort,
    group: filters.group,
    view: filters.view === "list" ? "list" : undefined,
  };
}

/** Keeps how the list is arranged (sort, grouping, view) and drops what narrows it. */
export function clearNarrowing({ sort, group, view }: MovieFilters): MovieFilters {
  return { sort, group, view };
}

/**
 * The filters that narrow the list as a comparable key: sort, grouping, view and unknown search
 * params are left out, and multi-select values are sorted, so the same filter set always matches.
 */
export function narrowingKey(filters: MovieFilters) {
  const { q, status, quality, hdr, decade, genre } = cleanFilters(filters);
  return JSON.stringify([q?.trim() || null, status, quality && [...quality].sort(), hdr, decade, genre && [...genre].sort()]);
}

/** Whether any filter (not counting sort, grouping or view) narrows the list. */
export function hasActiveFilters(filters: MovieFilters) {
  return Boolean(filters.q?.trim() || filters.status || filters.quality?.length || filters.hdr || filters.decade || filters.genre?.length);
}
