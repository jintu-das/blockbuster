import { useQueryClient } from "@tanstack/react-query";
import { toast } from "@/components/ui/toast";
import { libraryKeys } from "../api/library-api";
import { errorMessage } from "../lib/error-message";
import { formatScanSummary } from "../lib/format-scan-summary";
import type { ScanSummary } from "../types";

/** Shared `onSuccess`/`onError` for every mutation that ends in a scan: toast, then refresh the catalog. */
export function useScanResultHandlers({ successTitle, errorTitle }: { successTitle: string; errorTitle: string }) {
  const queryClient = useQueryClient();
  return {
    onSuccess: (summary: ScanSummary) => {
      toast.add({ title: successTitle, description: formatScanSummary(summary), type: "success" });
      return queryClient.invalidateQueries({ queryKey: libraryKeys.all });
    },
    onError: (error: unknown) => {
      toast.add({ title: errorTitle, description: errorMessage(error), type: "error" });
    },
  };
}
