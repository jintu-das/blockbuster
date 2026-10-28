import { useQueryClient } from "@tanstack/react-query";
import { toast } from "@/components/ui/toast";
import { errorMessage } from "@/features/library";
import { subtitleKeys, subtitlesApi } from "../api/subtitles-api";
import { subtitleChoice } from "../lib/subtitle-choice";
import type { AddedSubtitle } from "../types";

/**
 * Selects a subtitle that was just added or downloaded, since that usually means wanting it on.
 * Kept apart from storing it, so a failure here says the subtitle is stored but not selected
 * (a download has already used quota by then) instead of reporting the whole add as failed.
 */
export function useSelectNewSubtitle(movieId: string) {
  const queryClient = useQueryClient();
  return async (subtitle: AddedSubtitle) => {
    try {
      await subtitlesApi.setChoice(movieId, subtitleChoice.added(subtitle.id));
    } catch (error) {
      toast.add({
        title: "Subtitle saved but not selected",
        description: `${errorMessage(error)} Pick it in the list to use it.`,
        type: "error",
      });
    }
    await queryClient.invalidateQueries({ queryKey: subtitleKeys.of(movieId), exact: true });
  };
}
