import type { OmdbMetadata } from "../types";

/** Raw OMDb reply for a lookup by id or title (`?i=tt...&plot=full`). Missing values are the string "N/A". */
export type OmdbMovieDto = {
  Title: string;
  Year: string;
  Rated: string;
  Released: string;
  Runtime: string;
  Genre: string;
  Director: string;
  Writer: string;
  Actors: string;
  Plot: string;
  Language: string;
  Country: string;
  Awards: string;
  Poster: string;
  Ratings: { Source: string; Value: string }[];
  Metascore: string;
  imdbRating: string;
  imdbVotes: string;
  imdbID: string;
  Type: string;
  DVD: string;
  BoxOffice: string;
  Production: string;
  Website: string;
  Response: "True";
};

function present(value: string) {
  return value === "N/A" || value === "" ? undefined : value;
}

function list(value: string) {
  return present(value)?.split(", ") ?? [];
}

export function toOmdbMetadata(dto: OmdbMovieDto): OmdbMetadata {
  return {
    imdbId: dto.imdbID,
    rated: present(dto.Rated),
    released: present(dto.Released),
    plot: present(dto.Plot),
    genres: list(dto.Genre),
    directors: list(dto.Director),
    writers: list(dto.Writer),
    actors: list(dto.Actors),
    languages: list(dto.Language),
    countries: list(dto.Country),
    awards: present(dto.Awards),
    ratings: dto.Ratings.map((rating) => ({ source: rating.Source, value: rating.Value })),
    imdbRating: present(dto.imdbRating),
    imdbVotes: present(dto.imdbVotes),
    boxOffice: present(dto.BoxOffice),
  };
}
