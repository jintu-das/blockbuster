import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/components/ui/toast";
import { errorMessage } from "@/features/library";
import { subtitleKeys, subtitlesApi } from "../api/subtitles-api";
import type { SubtitleResult } from "../types";
import { useSelectNewSubtitle } from "./use-select-new-subtitle";

/** Downloads a search result and selects it. Downloading one again reuses the stored copy. */
export function useDownloadSubtitle(movieId: string) {
  const queryClient = useQueryClient();
  const select = useSelectNewSubtitle(movieId);
  return useMutation({
    mutationFn: (result: SubtitleResult) => subtitlesApi.download(movieId, result),
    onSuccess: ({ subtitle, remaining, alreadyAdded }) => {
      const description = alreadyAdded
        ? "You already had this one, so no download was used. It plays next time."
        : `It plays next time.${remaining !== undefined ? ` ${remaining} downloads left today.` : ""}`;
      toast.add({ title: "Subtitle downloaded", description, type: "success" });
      return select(subtitle);
    },
    onError: (error) => {
      toast.add({ title: "Couldn't download the subtitle", description: errorMessage(error), type: "error" });
      return queryClient.invalidateQueries({ queryKey: subtitleKeys.of(movieId), exact: true });
    },
  });
}
