import { FolderOpenIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useChooseLibraryFolder } from "../hooks/use-choose-library-folder";
import { useLibraryBusy } from "../hooks/use-library-busy";
import { useLibraryFolder } from "../hooks/use-library-folder";
import { useLibraryMovies } from "../hooks/use-library-movies";
import { formatMovieCount } from "../lib/format-movie-count";
import { LibraryEmptyState } from "./library-empty-state";
import { LibraryLoadError } from "./library-load-error";
import { MovieGrid } from "./movie-grid";
import { MovieGridSkeleton } from "./movie-grid-skeleton";

export function LibraryPage() {
  const { data: folder } = useLibraryFolder();
  const { movies, isLoading, error, refetch } = useLibraryMovies();
  const chooseFolder = useChooseLibraryFolder();
  const isBusy = useLibraryBusy();
  const hasMovies = movies.length > 0;

  return (
    <div className="flex flex-1 flex-col gap-6">
      <div className="flex items-end justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="font-heading text-2xl font-semibold">Library</h1>
          {folder && (
            <p className="truncate font-mono text-xs text-muted-foreground" title={folder}>
              {hasMovies && `${formatMovieCount(movies.length)} • `}
              {folder}
            </p>
          )}
        </div>
        {/* Without movies, the empty state below owns the folder action. */}
        {hasMovies && (
          <Button variant="outline" onClick={chooseFolder} disabled={isBusy}>
            <FolderOpenIcon data-icon="inline-start" />
            Change folder
          </Button>
        )}
      </div>

      {error ? (
        <LibraryLoadError error={error} onRetry={refetch} />
      ) : isLoading ? (
        <MovieGridSkeleton />
      ) : hasMovies ? (
        <MovieGrid movies={movies} />
      ) : (
        <LibraryEmptyState />
      )}
    </div>
  );
}
