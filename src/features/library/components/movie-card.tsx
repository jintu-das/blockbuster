import { Link } from "@tanstack/react-router";
import { FilmIcon, PlayIcon, StarIcon } from "lucide-react";
import { useRef } from "react";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Spinner } from "@/components/ui/spinner";
import { useInView } from "../hooks/use-in-view";
import { usePlayMovie } from "../hooks/use-play-movie";
import { useThumbnail } from "../hooks/use-thumbnail";
import { formatDuration } from "../lib/format-duration";
import { formatFileSize } from "../lib/format-file-size";
import type { Movie } from "../types";

export function MovieCard({ movie, showRating = false }: { movie: Movie; showRating?: boolean }) {
  const playMovie = usePlayMovie();
  const ref = useRef<HTMLElement>(null);
  // A large library would otherwise request every poster at once when the grid mounts.
  const thumbnail = useThumbnail(movie, { enabled: useInView(ref) });
  const progress = Math.min(Math.max(movie.progress ?? 0, 0), 1);
  const details = [movie.year, movie.durationMinutes !== undefined && formatDuration(movie.durationMinutes)].filter(
    Boolean,
  );

  return (
    <article ref={ref} className="group/movie flex min-w-0 flex-col gap-2">
      <AspectRatio
        ratio={2 / 3}
        className="overflow-hidden rounded-xl bg-muted shadow-sm ring-1 ring-foreground/10 transition-all duration-300 group-hover/movie:-translate-y-1 group-hover/movie:shadow-xl group-hover/movie:ring-primary/60"
      >
        {thumbnail ? (
          <img
            src={thumbnail}
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

        {/* Darkens the poster on hover so the play button and badges stay readable. */}
        <div className="absolute inset-0 bg-linear-to-t from-black/60 via-black/10 to-transparent opacity-0 transition-opacity duration-300 group-focus-within/movie:opacity-100 group-hover/movie:opacity-100" />

        {progress > 0 && (
          <Progress
            value={progress * 100}
            aria-label="Watch progress"
            className="absolute inset-x-0 bottom-0 **:data-[slot=progress-track]:rounded-none **:data-[slot=progress-track]:bg-background/60"
          />
        )}

        {/* The poster opens the details page; the title link below is the keyboard path to it. */}
        <Link
          to="/movies/$movieId"
          params={{ movieId: movie.id }}
          tabIndex={-1}
          aria-hidden
          className="absolute inset-0 rounded-xl"
        />

        <button
          type="button"
          aria-label={progress > 0 ? `Resume ${movie.title}` : `Play ${movie.title}`}
          onClick={() => playMovie.mutate({ id: movie.id })}
          disabled={playMovie.isPending}
          data-pending={playMovie.isPending || undefined}
          className="absolute top-1/2 left-1/2 flex size-12 -translate-1/2 cursor-pointer items-center justify-center rounded-full bg-primary text-primary-foreground opacity-0 shadow-lg transition-all duration-300 outline-none group-focus-within/movie:opacity-100 group-hover/movie:opacity-100 hover:scale-110 focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-progress data-pending:opacity-100"
        >
          {playMovie.isPending ? <Spinner /> : <PlayIcon className="fill-current" />}
        </button>
      </AspectRatio>

      <div className="flex min-w-0 flex-col gap-0.5">
        <h3 className="truncate font-heading text-base font-semibold" title={movie.title}>
          <Link
            to="/movies/$movieId"
            params={{ movieId: movie.id }}
            className="rounded-sm outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            {movie.title}
          </Link>
        </h3>
        <p className="font-mono text-xs text-muted-foreground">
          {details.map((detail) => `${detail} • `)}
          <span className="font-semibold text-foreground">{formatFileSize(movie.sizeBytes)}</span>
        </p>
      </div>
    </article>
  );
}
