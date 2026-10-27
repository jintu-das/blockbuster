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

/** A stream from ffprobe, as the backend stores it (`probe::MediaStream`). */
export type MediaStream = {
  kind: "video" | "audio" | "subtitle";
  /** ffprobe's codec name, e.g. "hevc", "truehd", "hdmv_pgs_subtitle". */
  codec: string;
  profile: string | null;
  width: number | null;
  height: number | null;
  fps: number | null;
  hdr: boolean;
  /** The track players pick unless told otherwise. */
  default: boolean;
  channels: number | null;
  /** e.g. "7.1", "5.1(side)", "stereo". */
  channelLayout: string | null;
  sampleRate: number | null;
  bitrateKbps: number | null;
  /** ISO 639-2 code, e.g. "eng". */
  language: string | null;
  title: string | null;
};

/** Container and embedded streams from ffprobe, as the backend stores them (`probe::MediaInfo`). */
export type MediaInfo = {
  /** e.g. "Matroska". */
  container: string | null;
  bitrateKbps: number | null;
  streams: MediaStream[];
};
