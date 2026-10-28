import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/components/ui/toast";
import { errorMessage } from "@/features/library";
import { subtitleKeys, subtitlesApi } from "../api/subtitles-api";
import type { MovieSubtitles } from "../types";

/** Remembers the subtitle mpv starts with. The radio moves at once and moves back if saving fails. */
export function useSetSubtitleChoice(movieId: string) {
  const queryClient = useQueryClient();
  const key = subtitleKeys.of(movieId);
  return useMutation({
    mutationFn: (choice: string | undefined) => subtitlesApi.setChoice(movieId, choice),
    onMutate: async (choice) => {
      await queryClient.cancelQueries({ queryKey: key, exact: true });
      const previous = queryClient.getQueryData<MovieSubtitles>(key);
      if (previous) queryClient.setQueryData<MovieSubtitles>(key, { ...previous, choice });
      return { previous };
    },
    onError: (error, _choice, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous);
      toast.add({ title: "Couldn't save the subtitle choice", description: errorMessage(error), type: "error" });
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: key, exact: true }),
  });
}
