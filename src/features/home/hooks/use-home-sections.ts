import { useMemo, useState } from "react";
import type { Movie } from "@/features/library";
import { buildHomeSections } from "../lib/build-home-sections";

/** The Home billboard and shelves, rebuilt whenever the catalog refetches. */
export function useHomeSections(movies: Movie[]) {
  // One seed per visit: picks look random but stay put when a rescan refetches the catalog.
  const [seed] = useState(Math.random);
  return useMemo(() => buildHomeSections(movies, seed), [movies, seed]);
}
