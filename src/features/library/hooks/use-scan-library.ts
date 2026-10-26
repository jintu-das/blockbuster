import { useMutation } from "@tanstack/react-query";
import { libraryApi, libraryKeys } from "../api/library-api";
import { useScanResultHandlers } from "./use-scan-result-handlers";

export function useScanLibrary() {
  const handlers = useScanResultHandlers({ successTitle: "Library scanned", errorTitle: "Scan failed" });
  return useMutation({ mutationKey: libraryKeys.scan, mutationFn: libraryApi.scan, ...handlers });
}
