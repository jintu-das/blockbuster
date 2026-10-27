import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { listen } from "@tauri-apps/api/event";
import { LIBRARY_UPDATED_EVENT, libraryKeys, PLAYBACK_ENDED_EVENT } from "../api/library-api";

/**
 * Refreshes the catalog when the backend changes it on its own: when mpv closes (progress bars,
 * Continue Watching) and as the metadata pass fills in qualities and thumbnails. Mount once.
 */
export function useCatalogSync() {
  const queryClient = useQueryClient();

  useEffect(() => {
    let disposed = false;
    const unlisteners: (() => void)[] = [];
    const refetch = () => queryClient.invalidateQueries({ queryKey: libraryKeys.movies });
    for (const event of [PLAYBACK_ENDED_EVENT, LIBRARY_UPDATED_EVENT]) {
      listen(event, refetch)
        .then((stop) => (disposed ? stop() : unlisteners.push(stop)))
        .catch(() => {
          // Not running inside Tauri (e.g. plain `vite` in a browser); nothing to sync.
        });
    }
    return () => {
      disposed = true;
      unlisteners.forEach((stop) => stop());
    };
  }, [queryClient]);
}
