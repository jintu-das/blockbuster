import { useIsMutating } from "@tanstack/react-query";
import { libraryKeys } from "../api/library-api";

/** True while any scan or folder change is running, wherever it was started from. */
export function useLibraryBusy() {
  return useIsMutating({ mutationKey: libraryKeys.all }) > 0;
}
