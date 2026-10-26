export type Movie = {
  id: string;
  title: string;
  year: number;
  durationMinutes: number;
  sizeBytes: number;
  /** Short source label shown on the poster, e.g. "4K HDR". */
  quality?: string;
  /** Saved playback position as a fraction of the duration (0 to 1). */
  progress?: number;
  thumbnail?: string;
};
