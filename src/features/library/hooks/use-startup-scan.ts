import { useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/components/ui/toast";
import { libraryApi, libraryKeys } from "../api/library-api";
import { errorMessage } from "../lib/error-message";
import { formatScanSummary } from "../lib/format-scan-summary";
import { useLibraryFolder } from "./use-library-folder";

// Once per app run: survives StrictMode's double effect and remounts of the layout.
let started = false;

/**
 * Rescans the library folder when the app opens, so files added or deleted while it was closed
 * show up. It is an ordinary scan mutation, so scan buttons show it as busy and the catalog is
 * invalidated when it ends. It only toasts when something changed or the scan failed. Mount once.
 */
export function useStartupScan() {
  const queryClient = useQueryClient();
  const { data: folder } = useLibraryFolder();
  const { mutate } = useMutation({
    mutationKey: libraryKeys.scan,
    mutationFn: libraryApi.scan,
    onSuccess: (summary) => {
      if (summary.added + summary.updated + summary.missing > 0) {
        toast.add({ title: "Library updated", description: formatScanSummary(summary), type: "success" });
      }
      return queryClient.invalidateQueries({ queryKey: libraryKeys.all });
    },
    onError: (error) => {
      toast.add({ title: "Couldn't refresh the library", description: errorMessage(error), type: "error" });
    },
  });

  useEffect(() => {
    if (!folder || started) return;
    started = true;
    mutate();
  }, [folder, mutate]);
}
