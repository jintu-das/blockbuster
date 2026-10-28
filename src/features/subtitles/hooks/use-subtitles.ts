import { useQuery } from "@tanstack/react-query";
import { subtitleKeys, subtitlesApi } from "../api/subtitles-api";

/** Sidecar and added subtitles of a movie, and the remembered choice. */
export function useSubtitles(movieId: string) {
  return useQuery({ queryKey: subtitleKeys.of(movieId), queryFn: () => subtitlesApi.list(movieId) });
}
