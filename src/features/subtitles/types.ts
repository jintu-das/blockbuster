/** A subtitle stream inside the video, described by the caller (it comes from ffprobe's stream list). */
export type EmbeddedSubtitle = {
  /** 1-based position among the video's subtitle streams, as mpv numbers them. */
  index: number;
  /** e.g. "English" or the stream's title. */
  label: string;
  /** e.g. "PGS". */
  detail: string;
  /** The track mpv picks when nothing else is chosen. */
  isDefault: boolean;
};

/** A subtitle file next to the video, named after it (`Movie.en.srt`). */
export type SidecarSubtitle = {
  fileName: string;
  /** ISO 639-1 code, e.g. "en" or "pt-BR". */
  language?: string;
  /** Lowercase extension, e.g. "srt". */
  format: string;
  /** What the name says beyond the language, e.g. "forced". */
  tags?: string;
};

/** A subtitle the user added, stored in the app data folder. */
export type AddedSubtitle = {
  id: number;
  /** The original file name, or the OpenSubtitles release name. */
  label: string;
  language?: string;
  source: "file" | "opensubtitles";
  /** ISO timestamp. */
  addedAt: string;
};

export type MovieSubtitles = {
  sidecars: SidecarSubtitle[];
  added: AddedSubtitle[];
  /** The remembered choice: "off", "embedded:2", "sidecar:<file name>", "added:<id>"; undefined lets mpv decide. */
  choice?: string;
  /** Whether OpenSubtitles search is set up (`OPENSUBTITLES_API_KEY`). */
  searchEnabled: boolean;
};

/** One OpenSubtitles search result. */
export type SubtitleResult = {
  fileId: number;
  /** The release it was made for, e.g. "Arrival.2016.1080p.BluRay". */
  release: string;
  language?: string;
  downloads: number;
  hearingImpaired: boolean;
  /** Made for this exact file, so it should be in sync. */
  hashMatch: boolean;
};
