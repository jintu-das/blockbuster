import { FolderIcon, HardDriveIcon } from "lucide-react";
import { useMemo } from "react";
import { Progress, ProgressLabel, ProgressValue } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { formatFileSize, formatMovieCount, useLibraryFolder, useLibraryMovies } from "@/features/library";
import { mockDiskUsage } from "../data/mock-disk-usage";

/** The library folder with its movie count and size, above the (still mocked) disk usage. */
export function DiskUsageCard() {
  const { data: folder } = useLibraryFolder();
  const { movies } = useLibraryMovies();
  const { usedGb, totalGb } = mockDiskUsage;
  const libraryBytes = useMemo(() => movies.reduce((sum, movie) => sum + movie.sizeBytes, 0), [movies]);
  // The last path segment, ignoring trailing slashes; the root folder keeps its "/".
  const folderName = folder ? folder.replace(/\/+$/, "").split("/").pop() || folder : undefined;

  return (
    <div className="flex flex-col gap-3 rounded-lg border bg-background p-3">
      <div className="flex min-w-0 items-start gap-2">
        <FolderIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="truncate text-sm font-medium" title={folder ?? undefined}>
            {folderName ?? "No folder chosen"}
          </span>
          <span className="font-mono text-xs text-muted-foreground">
            {formatMovieCount(movies.length)} • {formatFileSize(libraryBytes)}
          </span>
        </div>
      </div>
      <Separator />
      <Progress value={(usedGb / totalGb) * 100}>
        <ProgressLabel className="flex items-center gap-1.5 text-xs font-normal text-muted-foreground">
          <HardDriveIcon className="size-3.5" />
          Disk: {usedGb} of {totalGb} GB used
        </ProgressLabel>
        <ProgressValue className="ml-auto font-mono text-xs" />
      </Progress>
    </div>
  );
}
