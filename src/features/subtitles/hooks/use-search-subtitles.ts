import { useQuery } from "@tanstack/react-query";
import { subtitleKeys, subtitlesApi } from "../api/subtitles-api";

/** OpenSubtitles results for one language, cached for the session so reopening the dialog is free. */
export function useSearchSubtitles(movieId: string, language: string, { enabled = true } = {}) {
  return useQuery({
    queryKey: subtitleKeys.search(movieId, language),
    queryFn: () => subtitlesApi.search(movieId, [language]),
    enabled,
    // A failed search (bad key, rate limit) is not worth repeating automatically.
    retry: false,
  });
}
