import { useMutation } from "@tanstack/react-query";
import { open } from "@tauri-apps/plugin-dialog";
import { toast } from "@/components/ui/toast";
import { libraryApi, libraryKeys } from "../api/library-api";
import { errorMessage } from "../lib/error-message";
import { useScanResultHandlers } from "./use-scan-result-handlers";

/**
 * Opens the native folder picker, then saves and scans the chosen folder. The dialog itself is
 * not part of the mutation, so busy indicators only show once a folder is actually being scanned.
 * Cancelling the dialog does nothing.
 */
export function useChooseLibraryFolder() {
  const handlers = useScanResultHandlers({
    successTitle: "Library folder set",
    errorTitle: "Couldn't use that folder",
  });
  const setFolder = useMutation({ mutationKey: libraryKeys.setFolder, mutationFn: libraryApi.setFolder, ...handlers });

  async function chooseFolder() {
    try {
      const folder = await open({ directory: true, multiple: false, title: "Choose your movie folder" });
      if (folder !== null) setFolder.mutate(folder);
    } catch (error) {
      toast.add({ title: "Couldn't open the folder picker", description: errorMessage(error), type: "error" });
    }
  }

  return chooseFolder;
}
