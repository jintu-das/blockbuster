import { FolderOpenIcon, SearchXIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import {
  formatFileSize,
  formatMovieCount,
  LibraryEmptyState,
  LibraryLoadError,
  MovieGrid,
  MovieGridSkeleton,
  useChooseLibraryFolder,
  useLibraryBusy,
  useLibraryFolder,
  useLibraryMovies,
  type Movie,
} from "@/features/library";
import { useCollapsedGroups } from "../hooks/use-collapsed-groups";
import { useFilteredMovies } from "../hooks/use-filtered-movies";
import { useMovieFacets } from "../hooks/use-movie-facets";
import { clearNarrowing, cleanFilters, hasActiveFilters } from "../lib/movie-filters";
import type { MovieFilters } from "../types";
import { ActiveFilterChips, MovieFilterBar } from "./movie-filter-bar";
import { MovieGroupSection } from "./movie-group-section";
import { MovieList } from "./movie-list";

/** Every movie in the library folder, filtered, sorted and optionally grouped. */
export function MoviesPage({
  filters,
  onFiltersChange,
}: {
  filters: MovieFilters;
  onFiltersChange: (filters: MovieFilters) => void;
}) {
  const { data: folder } = useLibraryFolder();
  const { movies, isLoading, error, refetch } = useLibraryMovies();
  const chooseFolder = useChooseLibraryFolder();
  const isBusy = useLibraryBusy();
  const { results, groups, totalBytes } = useFilteredMovies(movies, filters, folder);
  const { decades, genres } = useMovieFacets(movies);
  const collapse = useCollapsedGroups(filters.group);
  const setFilters = (next: MovieFilters) => onFiltersChange(cleanFilters(next));

  if (error) return <LibraryLoadError error={error} onRetry={refetch} />;
  if (isLoading) return <MovieGridSkeleton />;
  if (movies.length === 0) return <LibraryEmptyState />;

  const renderMovies = (list: Movie[]) =>
    filters.view === "list" ? <MovieList movies={list} /> : <MovieGrid movies={list} />;

  return (
    <div className="flex flex-1 flex-col gap-6">
      {/* Sticks under the app header (h-14) while scrolling through the collection. */}
      <div className="sticky top-14 z-10 -mx-6 -mt-6 flex flex-col gap-3 border-b bg-background/85 px-6 py-4 backdrop-blur-xl">
        <div className="flex items-end justify-between gap-4">
          <div className="flex min-w-0 flex-col gap-0.5">
            <h1 className="font-heading text-2xl font-semibold tracking-tight">Movies</h1>
            <p className="truncate font-mono text-xs text-muted-foreground" title={folder ?? undefined}>
              {hasActiveFilters(filters)
                ? `${results.length} of ${formatMovieCount(movies.length)}`
                : formatMovieCount(movies.length)}
              {` • ${formatFileSize(totalBytes)}`}
              {folder && ` • ${folder}`}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={chooseFolder} disabled={isBusy}>
            <FolderOpenIcon data-icon="inline-start" />
            Change folder
          </Button>
        </div>
        <MovieFilterBar filters={filters} onChange={setFilters} decades={decades} genres={genres} />
        <ActiveFilterChips filters={filters} onChange={setFilters} />
      </div>

      {results.length === 0 ? (
        <Empty className="flex-1 border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <SearchXIcon />
            </EmptyMedia>
            <EmptyTitle>No movies match</EmptyTitle>
            <EmptyDescription>Try removing a filter or searching for a different title.</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button variant="outline" onClick={() => setFilters(clearNarrowing(filters))}>
              Clear filters
            </Button>
          </EmptyContent>
        </Empty>
      ) : groups ? (
        <>
          <div className="-mt-2 flex items-center gap-1 text-xs text-muted-foreground">
            <span className="font-mono">{groups.length} groups</span>
            <Button variant="link" size="xs" className="text-muted-foreground" onClick={() => collapse.setAll(false)}>
              Expand all
            </Button>
            <Button variant="link" size="xs" className="text-muted-foreground" onClick={() => collapse.setAll(true)}>
              Collapse all
            </Button>
          </div>
          {groups.map((group) => (
            <MovieGroupSection
              key={group.key}
              group={group}
              collapsed={collapse.isCollapsed(group.key)}
              onToggle={collapse.toggle}
            >
              {renderMovies(group.movies)}
            </MovieGroupSection>
          ))}
        </>
      ) : (
        renderMovies(results)
      )}
    </div>
  );
}
