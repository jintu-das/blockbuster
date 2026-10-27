import type { Movie } from "@/features/library";

export type OmdbRating = {
  /** e.g. "Internet Movie Database", "Rotten Tomatoes", "Metacritic". */
  source: string;
  /** Kept as OMDb formats it per source: "8.0/10", "88%", "81/100". */
  value: string;
};

/** OMDb metadata mapped from `OmdbMovieDto`; list fields are split from OMDb's comma-separated strings. */
export type OmdbMetadata = {
  imdbId: string;
  /** Age rating, e.g. "R". */
  rated?: string;
  /** Release date as OMDb formats it, e.g. "06 Oct 2017". */
  released?: string;
  plot?: string;
  genres: string[];
  directors: string[];
  writers: string[];
  actors: string[];
  languages: string[];
  countries: string[];
  awards?: string;
  ratings: OmdbRating[];
  imdbRating?: string;
  imdbVotes?: string;
  boxOffice?: string;
};

/** A catalog movie plus its OMDb metadata, which is missing when OMDb had no match or no key is set. */
export type MovieDetails = Movie & { omdb?: OmdbMetadata; media?: MediaInfo };

export type MediaStream = {
  kind: "video" | "audio" | "subtitle";
  /** Codec as ffprobe names it for people, e.g. "HEVC (Main 10)", "Dolby TrueHD". */
  codec: string;
  /** One-line summary, e.g. "3840x2160 @ 23.976 fps • HDR10". */
  summary: string;
  language?: string;
};

/** Container and stream details from ffprobe. */
export type MediaInfo = {
  /** e.g. "Matroska". */
  container: string;
  bitrateMbps: number;
  /** Short audio label for the hero badges, e.g. "Dolby Atmos 7.1". */
  audioLabel?: string;
  streams: MediaStream[];
};
