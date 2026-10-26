import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/components/ui/toast";
import { libraryApi, libraryKeys, playerKeys } from "../api/library-api";
import { errorMessage } from "../lib/error-message";

/** Plays a movie in mpv. Resumes from the saved position unless `fromStart` is set. */
export function usePlayMovie() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: playerKeys.play,
    mutationFn: ({ id, fromStart = false }: { id: string; fromStart?: boolean }) => libraryApi.play(id, fromStart),
    // The backend stamps `last_played_at` as playback starts.
    onSuccess: () => queryClient.invalidateQueries({ queryKey: libraryKeys.movies }),
    onError: (error) => {
      toast.add({ title: "Couldn't play this movie", description: errorMessage(error), type: "error" });
    },
  });
}
