import { useMutation, useQueryClient } from "@tanstack/react-query";
import { open } from "@tauri-apps/plugin-dialog";
import { toast } from "@/components/ui/toast";
import { errorMessage } from "@/features/library";
import { subtitleKeys, subtitlesApi } from "../api/subtitles-api";
import { useSelectNewSubtitle } from "./use-select-new-subtitle";

const SUBTITLE_EXTENSIONS = ["srt", "ass", "ssa", "vtt", "sub"];

/**
 * Opens the native file picker, then copies the chosen subtitle into the app and selects it, since
 * adding one usually means wanting it on. Cancelling the picker does nothing.
 */
export function useAddSubtitleFile(movieId: string) {
  const queryClient = useQueryClient();
  const select = useSelectNewSubtitle(movieId);
  const add = useMutation({
    mutationFn: (path: string) => subtitlesApi.addFile(movieId, path),
    onSuccess: (subtitle) => {
      toast.add({ title: "Subtitle added", description: `${subtitle.label} plays next time.`, type: "success" });
      return select(subtitle);
    },
    onError: (error) => {
      toast.add({ title: "Couldn't add the subtitle", description: errorMessage(error), type: "error" });
      return queryClient.invalidateQueries({ queryKey: subtitleKeys.of(movieId), exact: true });
    },
  });

  async function addFile() {
    try {
      const path = await open({
        multiple: false,
        title: "Choose a subtitle file",
        filters: [{ name: "Subtitles", extensions: SUBTITLE_EXTENSIONS }],
      });
      if (path !== null) add.mutate(path);
    } catch (error) {
      toast.add({ title: "Couldn't open the file picker", description: errorMessage(error), type: "error" });
    }
  }

  return { addFile, isAdding: add.isPending };
}
