import { mockMovies } from "../data/mock-movies";
import type { Movie } from "../types";

// Mock catalog in development only, so release builds show the real empty state
// until the library scan is wired to the backend.
export function useLibraryMovies(): Movie[] {
  return import.meta.env.DEV ? mockMovies : [];
}
