import { FilmIcon, PlayIcon, StarIcon } from "lucide-react";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Spinner } from "@/components/ui/spinner";
import { usePlayMovie } from "../hooks/use-play-movie";
import { formatDuration } from "../lib/format-duration";
import { formatFileSize } from "../lib/format-file-size";
import type { Movie } from "../types";

export function MovieCard({ movie, showRating = false }: { movie: Movie; showRating?: boolean }) {
  const playMovie = usePlayMovie();
  const progress = Math.min(Math.max(movie.progress ?? 0, 0), 1);
  const details = [movie.year, movie.durationMinutes !== undefined && formatDuration(movie.durationMinutes)].filter(
    Boolean,
  );

  return (
    <article className="group/movie flex min-w-0 flex-col gap-2">
      <AspectRatio ratio={2 / 3} className="overflow-hidden rounded-xl bg-muted ring-1 ring-foreground/10">
        {movie.thumbnail ? (
          <img
            src={movie.thumbnail}
            alt=""
            className="size-full object-cover transition-transform duration-300 group-hover/movie:scale-105"
          />
        ) : (
          <div className="flex size-full flex-col items-center justify-center gap-3 p-4 text-center text-muted-foreground">
            <FilmIcon className="size-10" />
            <span className="line-clamp-2 font-heading text-sm font-medium">{movie.title}</span>
          </div>
        )}

        {movie.quality && (
          <Badge
            variant="outline"
            className="absolute top-2 left-2 border-transparent bg-background/85 font-mono tracking-wide"
          >
            {movie.quality}
          </Badge>
        )}

        {showRating && movie.rating !== undefined && (
          <Badge
            variant="outline"
            className="absolute top-2 right-2 border-transparent bg-background/85 font-mono"
          >
            <StarIcon data-icon="inline-start" className="fill-current" />
            {movie.rating.toFixed(1)}
          </Badge>
        )}

        {progress > 0 && (
          <Progress
            value={progress * 100}
            aria-label="Watch progress"
            className="absolute inset-x-0 bottom-0 **:data-[slot=progress-track]:rounded-none **:data-[slot=progress-track]:bg-background/60"
          />
        )}

        {/* Last child, so it sits above the badges and progress bar and takes every click on the poster. */}
        <button
          type="button"
          aria-label={progress > 0 ? `Resume ${movie.title}` : `Play ${movie.title}`}
          onClick={() => playMovie.mutate({ id: movie.id })}
          disabled={playMovie.isPending}
          className="absolute inset-0 flex cursor-pointer items-center justify-center rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-progress"
        >
          <span
            data-pending={playMovie.isPending || undefined}
            className="flex size-12 items-center justify-center rounded-full bg-background/85 text-foreground opacity-0 shadow-md transition-opacity group-focus-within/movie:opacity-100 group-hover/movie:opacity-100 data-pending:opacity-100"
          >
            {playMovie.isPending ? <Spinner /> : <PlayIcon className="fill-current" />}
          </span>
        </button>
      </AspectRatio>

      <div className="flex min-w-0 flex-col gap-0.5">
        <h3 className="truncate font-heading text-base font-semibold" title={movie.title}>
          {movie.title}
        </h3>
        <p className="font-mono text-xs text-muted-foreground">
          {details.map((detail) => `${detail} • `)}
          <span className="font-semibold text-foreground">{formatFileSize(movie.sizeBytes)}</span>
        </p>
      </div>
    </article>
  );
}
