import { FolderOpenIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Spinner } from "@/components/ui/spinner";
import { useChooseLibraryFolder } from "../hooks/use-choose-library-folder";
import { useLibraryBusy } from "../hooks/use-library-busy";
import { useLibraryFolder } from "../hooks/use-library-folder";
import { LibraryLoadError } from "./library-load-error";

/** Shown when no folder is chosen yet, or the chosen folder has no videos. Owns the folder action. */
export function LibraryEmptyState() {
  const folderQuery = useLibraryFolder();
  const chooseFolder = useChooseLibraryFolder();
  const isBusy = useLibraryBusy();

  // Wait for the saved folder before choosing between "no folder yet" and "no videos found".
  if (folderQuery.isPending) return null;
  if (folderQuery.isError) {
    return <LibraryLoadError error={folderQuery.error} onRetry={() => void folderQuery.refetch()} />;
  }
  const folder = folderQuery.data;

  return (
    <Empty className="flex-1 border">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <FolderOpenIcon />
        </EmptyMedia>
        <EmptyTitle>{folder ? "No videos found" : "No library folder yet"}</EmptyTitle>
        <EmptyDescription>
          {folder ? (
            <>
              Nothing playable in <span className="font-mono break-all">{folder}</span>. Add videos there and scan
              again, or choose another folder.
            </>
          ) : (
            "Choose a folder of videos to build your catalog."
          )}
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button onClick={chooseFolder} disabled={isBusy}>
          {isBusy ? <Spinner data-icon="inline-start" /> : <FolderOpenIcon data-icon="inline-start" />}
          {folder ? "Choose another folder" : "Choose folder"}
        </Button>
      </EmptyContent>
    </Empty>
  );
}
