import { Link, useCanGoBack, useRouter } from "@tanstack/react-router";
import { ArrowLeftIcon, PlayIcon, RotateCcwIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ArtworkBackdrop, formatDuration, usePlayMovie } from "@/features/library";
import { audioLabel, formatBitrate } from "../lib/describe-stream";
import { formatTimestamp } from "../lib/format-timestamp";
import type { MovieDetails } from "../types";

// Dot colors that identify each OMDb rating source at a glance.
const ratingSourceColors: Record<string, string> = {
  "Internet Movie Database": "bg-amber-400",
  "Rotten Tomatoes": "bg-red-500",
  Metacritic: "bg-emerald-400",
};

const backClassName = "self-start bg-background/60 backdrop-blur-md";

const ratingSourceLabels: Record<string, string> = {
  "Internet Movie Database": "IMDb",
};

export function MovieHero({ movie }: { movie: MovieDetails }) {
  const router = useRouter();
  const canGoBack = useCanGoBack();
  const playMovie = usePlayMovie();
  const { omdb, media } = movie;
  const audio = media && audioLabel(media.streams);
  const progress = Math.min(Math.max(movie.progress ?? 0, 0), 1);
  const resumeAt = progress > 0 ? movie.progressSeconds : undefined;
  const facts = [
    { key: "year", value: movie.year },
    { key: "rated", value: omdb?.rated },
    {
      key: "runtime",
      value:
        movie.durationMinutes !== undefined &&
        formatDuration(movie.durationMinutes),
    },
  ].filter((fact) => fact.value);

  return (
    <section className="relative isolate overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
      <ArtworkBackdrop movie={movie} />
      {/* Keeps text readable over the art. Stronger than the billboard's: the hero's text block is
          wider and denser, with small muted text, and below md the art spans the whole banner. */}
      <div className="absolute inset-0 -z-10 bg-linear-to-t from-card via-card/70 to-card/10" />
      <div className="absolute inset-0 -z-10 bg-linear-to-r from-card via-card/75 to-transparent" />
      {/* The Back button sits at the top, where the other overlays have faded out. */}
      <div className="absolute inset-x-0 top-0 -z-10 h-28 bg-linear-to-b from-card/70 to-transparent" />

      <div className="flex min-h-[420px] flex-col justify-between gap-10 p-6 lg:p-8">
        {canGoBack ? (
          <Button
            variant="secondary"
            size="sm"
            className={backClassName}
            onClick={() => router.history.back()}
          >
            <ArrowLeftIcon data-icon="inline-start" />
            Back
          </Button>
        ) : (
          // Opened directly (no history entry to return to), so fall back to the movie list.
          <Link
            to="/movies"
            className={buttonVariants({
              variant: "secondary",
              size: "sm",
              className: backClassName,
            })}
          >
            <ArrowLeftIcon data-icon="inline-start" />
            Movies
          </Link>
        )}

        <div className="flex max-w-4xl flex-col gap-4">
          <div className="flex flex-wrap items-center gap-2">
            {movie.quality && (
              <Badge className="font-mono tracking-wider uppercase">
                {movie.quality}
              </Badge>
            )}
            {audio && (
              <Badge variant="secondary" className="font-mono">
                {audio}
              </Badge>
            )}
            {media?.bitrateKbps != null && (
              <Badge variant="secondary" className="font-mono">
                {formatBitrate(media.bitrateKbps)}
              </Badge>
            )}
            {facts.map((fact) => (
              <span
                key={fact.key}
                className="flex items-center gap-2 text-sm text-muted-foreground"
              >
                <span aria-hidden>•</span>
                {fact.value}
              </span>
            ))}
          </div>

          <h1 className="font-heading text-4xl leading-none font-bold tracking-tight text-balance">
            {movie.title}
          </h1>

          {omdb && omdb.ratings.length > 0 && (
            <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-xs text-muted-foreground">
              {omdb.ratings.map((rating) => (
                <li key={rating.source} className="flex items-center gap-1.5">
                  <span
                    className={`size-2 rounded-full ${ratingSourceColors[rating.source] ?? "bg-muted-foreground"}`}
                  />
                  {ratingSourceLabels[rating.source] ?? rating.source}
                  <span className="font-medium text-foreground">
                    {rating.value}
                  </span>
                </li>
              ))}
            </ul>
          )}

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <Button
              size="lg"
              disabled={playMovie.isPending}
              onClick={() => playMovie.mutate({ id: movie.id })}
            >
              <PlayIcon data-icon="inline-start" className="fill-current" />
              {resumeAt !== undefined
                ? `Resume from ${formatTimestamp(resumeAt)}`
                : "Play"}
            </Button>
            {progress > 0 && (
              <Tooltip>
                <TooltipTrigger
                  render={
                    <Button
                      variant="secondary"
                      size="icon-lg"
                      aria-label="Play from start"
                      disabled={playMovie.isPending}
                      onClick={() =>
                        playMovie.mutate({ id: movie.id, fromStart: true })
                      }
                    />
                  }
                >
                  <RotateCcwIcon />
                </TooltipTrigger>
                <TooltipContent>Play from start</TooltipContent>
              </Tooltip>
            )}
          </div>

          {progress > 0 && (
            <Progress
              value={progress * 100}
              aria-label="Watch progress"
              className="max-w-md"
            >
              <span className="ml-auto font-mono text-xs text-muted-foreground">
                {Math.round(progress * 100)}% watched
              </span>
            </Progress>
          )}
        </div>
      </div>
    </section>
  );
}
