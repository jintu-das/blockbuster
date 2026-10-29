import { useQuery } from "@tanstack/react-query";
import { libraryApi, thumbnailKeys } from "../api/library-api";
import type { Movie } from "../types";
import { useThumbnail } from "./use-thumbnail";

/**
 * Large artwork for full-width banners as an image URL: the thumbnail first (usually already
 * loaded by a card), then the sharp version once the backend has fetched it.
 */
export function useArtwork(movie: Pick<Movie, "id" | "thumbnailFile">) {
  const thumbnail = useThumbnail(movie);
  const query = useQuery({
    queryKey: thumbnailKeys.artwork(movie.id, movie.thumbnailFile),
    queryFn: () => libraryApi.artwork(movie.id),
    enabled: movie.thumbnailFile !== undefined,
  });
  return query.data ?? thumbnail;
}
