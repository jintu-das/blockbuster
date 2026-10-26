import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { listen } from "@tauri-apps/api/event";
import { libraryKeys, PLAYBACK_ENDED_EVENT } from "../api/library-api";

/** Refreshes the catalog when mpv closes, so progress bars and Continue Watching update. Mount once. */
export function usePlaybackSync() {
  const queryClient = useQueryClient();

  useEffect(() => {
    let disposed = false;
    let unlisten: (() => void) | undefined;
    listen(PLAYBACK_ENDED_EVENT, () => queryClient.invalidateQueries({ queryKey: libraryKeys.movies }))
      .then((stop) => (disposed ? stop() : (unlisten = stop)))
      .catch(() => {
        // Not running inside Tauri (e.g. plain `vite` in a browser); nothing to sync.
      });
    return () => {
      disposed = true;
      unlisten?.();
    };
  }, [queryClient]);
}
