import { FolderOpenIcon, SearchXIcon } from "lucide-react";
import { useMemo, useState } from "react";
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
import { applyMovieFilters, decadeOf } from "../lib/apply-movie-filters";
import { groupMovies } from "../lib/group-movies";
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
  // Collapsed group keys; reset when the grouping changes, since keys differ per grouping.
  const [collapsed, setCollapsed] = useState<{ group?: string; keys: Set<string> }>({ keys: new Set() });
  const collapsedKeys = collapsed.group === filters.group ? collapsed.keys : new Set<string>();
  const setFilters = (next: MovieFilters) => onFiltersChange(cleanFilters(next));

  const results = useMemo(() => applyMovieFilters(movies, filters), [movies, filters]);
  const groups = useMemo(
    () => (filters.group ? groupMovies(results, filters.group, folder) : undefined),
    [results, filters.group, folder],
  );
  const decades = useMemo(
    () =>
      [...new Set(movies.flatMap((movie) => (movie.year !== undefined ? [decadeOf(movie.year)] : [])))].sort(
        (a, b) => b - a,
      ),
    [movies],
  );
  const totalBytes = useMemo(() => results.reduce((sum, movie) => sum + movie.sizeBytes, 0), [results]);

  if (error) return <LibraryLoadError error={error} onRetry={refetch} />;
  if (isLoading) return <MovieGridSkeleton />;
  if (movies.length === 0) return <LibraryEmptyState />;

  const toggleGroup = (key: string) => {
    const keys = new Set(collapsedKeys);
    if (!keys.delete(key)) keys.add(key);
    setCollapsed({ group: filters.group, keys });
  };
  const setAllCollapsed = (collapse: boolean) =>
    setCollapsed({ group: filters.group, keys: new Set(collapse ? groups?.map((group) => group.key) : []) });
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
        <MovieFilterBar filters={filters} onChange={setFilters} decades={decades} />
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
            <Button variant="link" size="xs" className="text-muted-foreground" onClick={() => setAllCollapsed(false)}>
              Expand all
            </Button>
            <Button variant="link" size="xs" className="text-muted-foreground" onClick={() => setAllCollapsed(true)}>
              Collapse all
            </Button>
          </div>
          {groups.map((group) => (
            <MovieGroupSection
              key={group.key}
              group={group}
              collapsed={collapsedKeys.has(group.key)}
              onToggle={() => toggleGroup(group.key)}
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
