import type { Movie } from "../types";

const GB = 1_000_000_000;
// Posters from Wikipedia (non-free, for local development only).
const POSTERS = "https://upload.wikimedia.org/wikipedia/en/";

// Placeholder catalog until the library scan is implemented.
export const mockMovies: Movie[] = [
  {
    id: "1",
    title: "Poor Things",
    thumbnail: `${POSTERS}f/f3/Poor_Things_poster.jpg`,
    year: 2023,
    durationMinutes: 141,
    sizeBytes: 22.8 * GB,
    quality: "4K HDR",
    progress: 0.62,
  },
  {
    id: "2",
    title: "Furiosa: A Mad Max Saga",
    thumbnail: `${POSTERS}3/34/Furiosa_A_Mad_Max_Saga.jpg`,
    year: 2024,
    durationMinutes: 148,
    sizeBytes: 47.1 * GB,
    quality: "4K REMUX",
    progress: 0.18,
  },
  {
    id: "3",
    title: "Blade Runner 2049",
    thumbnail: `${POSTERS}9/9b/Blade_Runner_2049_poster.png`,
    year: 2017,
    durationMinutes: 164,
    sizeBytes: 38.4 * GB,
    quality: "4K HDR",
  },
  {
    id: "4",
    title: "Spirited Away",
    thumbnail: `${POSTERS}d/db/Spirited_Away_Japanese_poster.png`,
    year: 2001,
    durationMinutes: 125,
    sizeBytes: 9.6 * GB,
    quality: "1080p",
  },
  {
    id: "5",
    title: "Arrival",
    thumbnail: `${POSTERS}d/df/Arrival%2C_Movie_Poster.jpg`,
    year: 2016,
    durationMinutes: 116,
    sizeBytes: 14.2 * GB,
    quality: "1080p",
    progress: 0.9,
  },
  {
    id: "6",
    title: "Parasite",
    thumbnail: `${POSTERS}5/53/Parasite_%282019_film%29.png`,
    year: 2019,
    durationMinutes: 132,
    sizeBytes: 18.7 * GB,
    quality: "4K",
  },
  {
    id: "7",
    title: "Dune: Part Two",
    thumbnail: `${POSTERS}5/52/Dune_Part_Two_poster.jpeg`,
    year: 2024,
    durationMinutes: 166,
    sizeBytes: 52.3 * GB,
    quality: "4K REMUX",
  },
  {
    id: "8",
    title: "Everything Everywhere All at Once",
    thumbnail: `${POSTERS}1/1e/Everything_Everywhere_All_at_Once.jpg`,
    year: 2022,
    durationMinutes: 139,
    sizeBytes: 21.5 * GB,
    quality: "4K HDR",
  },
  {
    id: "9",
    title: "Past Lives",
    thumbnail: `${POSTERS}d/da/Past_Lives_film_poster.png`,
    year: 2023,
    durationMinutes: 105,
    sizeBytes: 8.1 * GB,
    quality: "1080p",
  },
];
