import { toOmdbMetadata, type OmdbMovieDto } from "../api/omdb-movie";
import type { MovieDetails } from "../types";

// Shape of a real OMDb reply (`?i=tt1856101&plot=full`), kept as a fixture until the backend stores it.
const mockOmdbReply: OmdbMovieDto = {
  Title: "Blade Runner 2049",
  Year: "2017",
  Rated: "R",
  Released: "06 Oct 2017",
  Runtime: "164 min",
  Genre: "Action, Drama, Mystery",
  Director: "Denis Villeneuve",
  Writer: "Hampton Fancher, Michael Green, Philip K. Dick",
  Actors: "Harrison Ford, Ryan Gosling, Ana de Armas",
  Plot:
    "Young Blade Runner K's discovery of a long-buried secret leads him to track down former Blade Runner Rick Deckard, who's been missing for thirty years.",
  Language: "English, Finnish, Japanese, Hungarian, Russian, Somali, Spanish",
  Country: "United States, United Kingdom, Hungary, Canada, Spain",
  Awards: "Won 2 Oscars. 99 wins & 352 nominations total",
  Poster: "N/A",
  Ratings: [
    { Source: "Internet Movie Database", Value: "8.0/10" },
    { Source: "Rotten Tomatoes", Value: "88%" },
    { Source: "Metacritic", Value: "81/100" },
  ],
  Metascore: "81",
  imdbRating: "8.0",
  imdbVotes: "693,000",
  imdbID: "tt1856101",
  Type: "movie",
  DVD: "N/A",
  BoxOffice: "$92,071,675",
  Production: "N/A",
  Website: "N/A",
  Response: "True",
};

// Placeholder until the backend stores OMDb replies and ffprobe stream details. The same sample is
// attached to every movie; title, progress, file and thumbnail come from the real catalog row.
export const mockMovieMetadata: Pick<MovieDetails, "omdb" | "media"> = {
  omdb: toOmdbMetadata(mockOmdbReply),
  media: {
    container: "Matroska",
    bitrateMbps: 54.6,
    audioLabel: "Dolby Atmos 7.1",
    streams: [
      { kind: "video", codec: "HEVC (Main 10)", summary: "3840x2160 @ 23.976 fps • HDR10" },
      { kind: "audio", codec: "Dolby TrueHD", summary: "Atmos 7.1 • 48 kHz 24-bit", language: "English" },
      { kind: "audio", codec: "AC-3", summary: "5.1 @ 640 kb/s • 48 kHz", language: "English commentary" },
      { kind: "subtitle", codec: "PGS", summary: "Embedded", language: "English SDH" },
      { kind: "subtitle", codec: "SubRip", summary: "External .srt", language: "Spanish" },
    ],
  },
};
