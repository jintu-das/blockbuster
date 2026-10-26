import { useQuery } from "@tanstack/react-query";
import { libraryApi, libraryKeys } from "../api/library-api";

export function useLibraryFolder() {
  return useQuery({ queryKey: libraryKeys.folder, queryFn: libraryApi.getFolder });
}
