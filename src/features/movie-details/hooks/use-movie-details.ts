import { useQuery } from "@tanstack/react-query";
import { movieDetailsApi, movieDetailsKeys } from "../api/movie-details-api";

/** Stored OMDb and stream details for a movie; fields stay undefined until the metadata pass fills them. */
export function useMovieDetails(id: string, { enabled = true } = {}) {
  return useQuery({ queryKey: movieDetailsKeys.of(id), queryFn: () => movieDetailsApi.get(id), enabled });
}
