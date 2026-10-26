import { FilmIcon, PlayIcon, RotateCcwIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress, ProgressLabel } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { formatDuration, formatFileSize, type Movie } from "@/features/library";

export function ContinueWatchingHero({ movie }: { movie: Movie }) {
  const progress = Math.min(Math.max(movie.progress ?? 0, 0), 1);
  const remainingMinutes = Math.round(movie.durationMinutes * (1 - progress));

  return (
    <section className="relative isolate overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
      {movie.thumbnail && (
        <img
          src={movie.thumbnail}
          alt=""
          className="absolute inset-0 -z-10 size-full object-cover object-top opacity-25"
        />
      )}
      <div className="absolute inset-0 -z-10 bg-linear-to-r from-card via-card/85 to-card/30" />

      <div className="flex items-end gap-8 p-6 md:p-8">
        <div className="flex min-w-0 flex-1 flex-col gap-4">
          <div className="flex min-w-0 items-center gap-2">
            <Badge>Continue watching</Badge>
            <span className="truncate font-mono text-xs text-muted-foreground">{movie.filePath}</span>
          </div>

          <h1 className="font-heading text-3xl font-bold tracking-tight text-balance md:text-4xl">
            {movie.title}
          </h1>

          <div className="flex flex-wrap items-center gap-2">
            {movie.quality && (
              <Badge variant="secondary" className="font-mono">
                {movie.quality}
              </Badge>
            )}
            <Badge variant="secondary" className="font-mono">
              {movie.year}
            </Badge>
            <Badge variant="secondary" className="font-mono">
              {formatDuration(movie.durationMinutes)}
            </Badge>
            <Badge variant="secondary" className="font-mono">
              {formatFileSize(movie.sizeBytes)}
            </Badge>
          </div>

          <Progress value={progress * 100} className="max-w-xl">
            <ProgressLabel className="font-mono text-xs">
              {formatDuration(remainingMinutes)} remaining
            </ProgressLabel>
            <span className="ml-auto font-mono text-xs text-muted-foreground">
              {Math.round(progress * 100)}% watched
            </span>
          </Progress>

          <div className="flex items-center gap-2">
            <Button size="lg">
              <PlayIcon data-icon="inline-start" />
              Resume
            </Button>
            <Tooltip>
              <TooltipTrigger render={<Button variant="outline" size="icon-lg" aria-label="Play from start" />}>
                <RotateCcwIcon />
              </TooltipTrigger>
              <TooltipContent>Play from start</TooltipContent>
            </Tooltip>
          </div>
        </div>

        <div className="hidden w-40 shrink-0 overflow-hidden rounded-lg bg-muted shadow-lg ring-1 ring-foreground/10 lg:block">
          {movie.thumbnail ? (
            <img src={movie.thumbnail} alt="" className="aspect-2/3 w-full object-cover" />
          ) : (
            <div className="flex aspect-2/3 items-center justify-center text-muted-foreground">
              <FilmIcon className="size-10" />
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
