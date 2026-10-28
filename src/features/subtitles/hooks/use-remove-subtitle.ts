import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/components/ui/toast";
import { errorMessage } from "@/features/library";
import { subtitleKeys, subtitlesApi } from "../api/subtitles-api";

/** Deletes an added subtitle; if it was the choice, mpv decides again. */
export function useRemoveSubtitle(movieId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (subtitleId: number) => subtitlesApi.remove(subtitleId),
    onError: (error) => {
      toast.add({ title: "Couldn't remove the subtitle", description: errorMessage(error), type: "error" });
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: subtitleKeys.of(movieId), exact: true }),
  });
}
