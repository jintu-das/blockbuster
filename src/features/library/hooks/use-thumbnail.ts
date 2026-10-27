import { useQuery } from "@tanstack/react-query";
import { libraryApi, thumbnailKeys } from "../api/library-api";
import type { Movie } from "../types";

/**
 * The movie's poster or frame as an image URL, or `undefined` while loading or if it has none.
 * Pass `enabled: false` to hold off loading, e.g. until a card scrolls into view.
 */
export function useThumbnail(movie: Pick<Movie, "id" | "thumbnailFile">, { enabled = true } = {}) {
  const query = useQuery({
    queryKey: thumbnailKeys.of(movie.id, movie.thumbnailFile),
    queryFn: () => libraryApi.thumbnail(movie.id),
    // The default `gcTime` drops images of unmounted cards and superseded files after a while.
    enabled: enabled && movie.thumbnailFile !== undefined,
  });
  return query.data;
}
