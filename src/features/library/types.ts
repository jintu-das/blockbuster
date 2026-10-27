export type Movie = {
  id: string;
  title: string;
  year?: number;
  /** Unknown until ffprobe or a playback session has read it. */
  durationMinutes?: number;
  sizeBytes: number;
  /** Resolution label from ffprobe shown on the poster, e.g. "4K HDR". */
  quality?: string;
  /** Saved playback position as a fraction of the duration (0 to 1). */
  progress?: number;
  /** Saved playback position in seconds, where mpv resumes. */
  progressSeconds?: number;
  /** File name of the generated poster (OMDb) or video frame; load it with `useThumbnail`. */
  thumbnailFile?: string;
  /** Absolute path of the video file on disk. */
  filePath: string;
  /** ISO timestamp of when the scan first found the file. */
  addedAt: string;
  /** ISO timestamp of the last playback session, if any. */
  lastPlayedAt?: string;
  inWatchlist?: boolean;
  isFavorite?: boolean;
  /** Personal rating from 0 to 5. */
  rating?: number;
};

export type ScanSummary = {
  added: number;
  updated: number;
  missing: number;
};
