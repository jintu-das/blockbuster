import { Link } from "@tanstack/react-router";
import { FilmIcon, PlayIcon } from "lucide-react";
import { useRef } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Spinner } from "@/components/ui/spinner";
import {
  formatDuration,
  formatFileSize,
  useInView,
  usePlayMovie,
  useThumbnail,
  type Movie,
} from "@/features/library";
import { watchStatusOf } from "../lib/apply-movie-filters";

const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: "medium" });

const statusLabels = { unwatched: "Unwatched", "in-progress": "In progress", watched: "Watched" };

function MovieListRow({ movie }: { movie: Movie }) {
  const ref = useRef<HTMLTableRowElement>(null);
  const thumbnail = useThumbnail(movie, { enabled: useInView(ref) });
  const playMovie = usePlayMovie();
  const status = watchStatusOf(movie);
  const progress = Math.min(Math.max(movie.progress ?? 0, 0), 1);
  const fileName = movie.filePath.slice(movie.filePath.lastIndexOf("/") + 1);

  return (
    <tr ref={ref} className="group/row border-b last:border-b-0 hover:bg-muted/50">
      <td className="py-2 pr-3 pl-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex aspect-2/3 w-9 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted text-muted-foreground ring-1 ring-foreground/10">
            {thumbnail ? <img src={thumbnail} alt="" className="size-full object-cover" /> : <FilmIcon className="size-4" />}
          </div>
          <div className="flex min-w-0 flex-col">
            <Link
              to="/movies/$movieId"
              params={{ movieId: movie.id }}
              className="truncate font-medium outline-none hover:underline focus-visible:underline"
              title={movie.title}
            >
              {movie.title}
            </Link>
            <span className="truncate font-mono text-[11px] text-muted-foreground" title={movie.filePath}>
              {fileName}
            </span>
          </div>
        </div>
      </td>
      <td className="px-3 py-2 font-mono text-xs">{movie.year ?? "—"}</td>
      <td className="hidden px-3 py-2 font-mono text-xs md:table-cell">
        {movie.durationMinutes !== undefined ? formatDuration(movie.durationMinutes) : "—"}
      </td>
      <td className="px-3 py-2">
        {movie.quality ? (
          <Badge variant="secondary" className="font-mono">
            {movie.quality}
          </Badge>
        ) : (
          <span className="font-mono text-xs text-muted-foreground">—</span>
        )}
      </td>
      <td className="hidden px-3 py-2 text-right font-mono text-xs lg:table-cell">{formatFileSize(movie.sizeBytes)}</td>
      <td className="hidden px-3 py-2 font-mono text-xs text-muted-foreground lg:table-cell">
        {dateFormat.format(new Date(movie.addedAt))}
      </td>
      <td className="hidden px-3 py-2 sm:table-cell">
        {status === "in-progress" ? (
          <Progress value={progress * 100} aria-label="Watch progress" className="w-20" />
        ) : (
          <span className="text-xs text-muted-foreground">{statusLabels[status]}</span>
        )}
      </td>
      <td className="py-2 pr-3 pl-1 text-right">
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={progress > 0 ? `Resume ${movie.title}` : `Play ${movie.title}`}
          disabled={playMovie.isPending}
          onClick={() => playMovie.mutate({ id: movie.id })}
          className="opacity-60 group-hover/row:opacity-100"
        >
          {playMovie.isPending ? <Spinner /> : <PlayIcon className="fill-current" />}
        </Button>
      </td>
    </tr>
  );
}

/** Dense table view, for scanning a large collection by its details. */
export function MovieList({ movies }: { movies: Movie[] }) {
  return (
    <div className="overflow-hidden rounded-xl ring-1 ring-foreground/10">
      <table className="w-full table-fixed text-sm">
        <colgroup>
          <col />
          <col className="w-16" />
          <col className="hidden w-20 md:table-column" />
          <col className="w-24" />
          <col className="hidden w-24 lg:table-column" />
          <col className="hidden w-32 lg:table-column" />
          <col className="hidden w-28 sm:table-column" />
          <col className="w-12" />
        </colgroup>
        <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
          <tr>
            <th className="py-2 pr-3 pl-3 font-medium">Title</th>
            <th className="px-3 py-2 font-medium">Year</th>
            <th className="hidden px-3 py-2 font-medium md:table-cell">Runtime</th>
            <th className="px-3 py-2 font-medium">Quality</th>
            <th className="hidden px-3 py-2 text-right font-medium lg:table-cell">Size</th>
            <th className="hidden px-3 py-2 font-medium lg:table-cell">Added</th>
            <th className="hidden px-3 py-2 font-medium sm:table-cell">Status</th>
            <th className="py-2 pr-3 pl-1">
              <span className="sr-only">Play</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {movies.map((movie) => (
            <MovieListRow key={movie.id} movie={movie} />
          ))}
        </tbody>
      </table>
    </div>
  );
}
