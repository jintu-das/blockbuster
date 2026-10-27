export type WatchStatus = "unwatched" | "in-progress" | "watched";

/** The resolution part of a quality label such as "4K HDR". */
export type Resolution = "4K" | "1080p" | "720p" | "SD";

export type SortKey = "added" | "played" | "title" | "year" | "size";

export type GroupKey = "letter" | "decade" | "quality" | "status" | "folder";

export type ViewMode = "grid" | "list";

/** Movies page filters, kept in the URL so they survive opening a movie and coming back. */
export type MovieFilters = {
  /** Title search. */
  q?: string;
  status?: WatchStatus;
  quality?: Resolution[];
  hdr?: boolean;
  /** First year of a decade, e.g. 1990. */
  decade?: number;
  sort?: SortKey;
  /** Unset shows one flat list. */
  group?: GroupKey;
  view?: ViewMode;
};
