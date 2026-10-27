import { Link } from "@tanstack/react-router";
import { ChevronLeftIcon, ChevronRightIcon, InfoIcon, PlayIcon, RotateCcwIcon } from "lucide-react";
import { useEffect, useState, useSyncExternalStore } from "react";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { formatDuration, formatFileSize, PosterImage, usePlayMovie, useThumbnail, type Movie } from "@/features/library";
import { cn } from "@/lib/utils";

const ROTATE_MS = 8000;

export type BillboardItem = { movie: Movie; eyebrow: string };

function BillboardSlide({ item }: { item: BillboardItem }) {
  const { movie } = item;
  const playMovie = usePlayMovie();
  const thumbnail = useThumbnail(movie);
  const progress = Math.min(Math.max(movie.progress ?? 0, 0), 1);
  const remainingMinutes =
    movie.durationMinutes !== undefined ? Math.round(movie.durationMinutes * (1 - progress)) : undefined;
  const facts = [
    { key: "year", value: movie.year },
    { key: "runtime", value: movie.durationMinutes !== undefined && formatDuration(movie.durationMinutes) },
    { key: "size", value: formatFileSize(movie.sizeBytes) },
  ].filter((fact) => fact.value);

  return (
    <div className="absolute inset-0 isolate animate-in duration-700 fade-in">
      {thumbnail && (
        <img
          src={thumbnail}
          alt=""
          className="absolute inset-0 -z-10 size-full scale-110 object-cover object-top opacity-55 blur-2xl"
        />
      )}
      <div className="absolute inset-0 -z-10 bg-linear-to-r from-card via-card/80 to-card/10" />
      <div className="absolute inset-0 -z-10 bg-linear-to-t from-card via-card/20 to-transparent" />

      <div className="flex h-full items-end gap-10 p-6 pb-14 md:p-10 md:pb-16">
        <div className="flex max-w-2xl min-w-0 flex-1 flex-col gap-4">
          <Badge variant="secondary" className="bg-background/60 backdrop-blur-md">
            {item.eyebrow}
          </Badge>
          <h1 className="line-clamp-2 font-heading text-4xl leading-none font-bold tracking-tight text-balance md:text-6xl">
            {movie.title}
          </h1>
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            {movie.quality && <Badge className="font-mono tracking-wider uppercase">{movie.quality}</Badge>}
            {facts.map((fact, index) => (
              <span key={fact.key} className="flex items-center gap-2">
                {(index > 0 || movie.quality) && <span aria-hidden>•</span>}
                {fact.value}
              </span>
            ))}
          </div>

          {progress > 0 && (
            <div className="flex max-w-md items-center gap-3">
              <Progress value={progress * 100} aria-label="Watch progress" className="flex-1" />
              <span className="shrink-0 font-mono text-xs text-muted-foreground">
                {remainingMinutes !== undefined ? `${formatDuration(remainingMinutes)} left` : `${Math.round(progress * 100)}%`}
              </span>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <Button size="lg" disabled={playMovie.isPending} onClick={() => playMovie.mutate({ id: movie.id })}>
              <PlayIcon data-icon="inline-start" className="fill-current" />
              {progress > 0 ? "Resume" : "Play"}
            </Button>
            <Link
              to="/movies/$movieId"
              params={{ movieId: movie.id }}
              className={buttonVariants({ variant: "secondary", size: "lg", className: "bg-background/60 backdrop-blur-md" })}
            >
              <InfoIcon data-icon="inline-start" />
              Details
            </Link>
            {progress > 0 && (
              <Tooltip>
                <TooltipTrigger
                  render={
                    <Button
                      variant="secondary"
                      size="icon-lg"
                      aria-label="Play from start"
                      className="bg-background/60 backdrop-blur-md"
                      disabled={playMovie.isPending}
                      onClick={() => playMovie.mutate({ id: movie.id, fromStart: true })}
                    />
                  }
                >
                  <RotateCcwIcon />
                </TooltipTrigger>
                <TooltipContent>Play from start</TooltipContent>
              </Tooltip>
            )}
          </div>
        </div>

        <div className="hidden aspect-2/3 w-44 shrink-0 overflow-hidden rounded-xl bg-muted shadow-2xl ring-1 ring-foreground/10 lg:block xl:w-52">
          <PosterImage src={thumbnail} />
        </div>
      </div>
    </div>
  );
}

const reducedMotionQuery = "(prefers-reduced-motion: reduce)";

function subscribeReducedMotion(onChange: () => void) {
  const query = window.matchMedia(reducedMotionQuery);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

/** Follows the OS setting live, so turning it on stops rotation right away. */
function usePrefersReducedMotion() {
  return useSyncExternalStore(subscribeReducedMotion, () => window.matchMedia(reducedMotionQuery).matches);
}

/** Full-width featured banner that rotates through a few movies, pausing while hovered or focused. */
export function HomeBillboard({ items }: { items: BillboardItem[] }) {
  // Tracked by movie, not position: a refetch can reorder `items` (a pick that was just played
  // moves up), and the banner must keep showing the movie the user is looking at.
  const [activeId, setActiveId] = useState<string>();
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const reducedMotion = usePrefersReducedMotion();
  const count = items.length;
  const foundIndex = items.findIndex((item) => item.movie.id === activeId);
  const activeIndex = foundIndex === -1 ? 0 : foundIndex;
  const active = items[activeIndex];
  const nextId = items[(activeIndex + 1) % Math.max(count, 1)]?.movie.id;

  // A timeout per slide, so any change of slide (rotation or a click) restarts the countdown.
  useEffect(() => {
    if (hovered || focused || reducedMotion || count < 2) return;
    const timer = window.setTimeout(() => setActiveId(nextId), ROTATE_MS);
    return () => window.clearTimeout(timer);
  }, [hovered, focused, reducedMotion, count, active?.movie.id, nextId]);

  if (!active) return null;
  const go = (step: number) => setActiveId(items[(activeIndex + step + count) % count].movie.id);

  return (
    <section
      aria-roledescription="carousel"
      aria-label="Featured movies"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={(event) => {
        // Focus moving between the banner's own buttons is not leaving it.
        if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false);
      }}
      className="relative h-[24rem] overflow-hidden rounded-2xl bg-card ring-1 ring-foreground/10 md:h-[28rem]"
    >
      <BillboardSlide key={active.movie.id} item={active} />

      {count > 1 && (
        <div className="absolute right-6 bottom-5 left-6 flex items-center justify-between gap-4 md:right-10 md:left-10">
          <div className="flex items-center gap-1.5">
            {items.map((item, itemIndex) => (
              <button
                key={item.movie.id}
                type="button"
                aria-label={`Show ${item.movie.title}`}
                aria-current={itemIndex === activeIndex}
                onClick={() => setActiveId(item.movie.id)}
                className={cn(
                  "h-1.5 rounded-full bg-foreground/30 transition-all outline-none hover:bg-foreground/60 focus-visible:ring-3 focus-visible:ring-ring/50",
                  itemIndex === activeIndex ? "w-6 bg-foreground" : "w-1.5",
                )}
              />
            ))}
          </div>
          <div className="flex gap-1">
            <Button variant="ghost" size="icon-sm" aria-label="Previous featured movie" onClick={() => go(-1)}>
              <ChevronLeftIcon />
            </Button>
            <Button variant="ghost" size="icon-sm" aria-label="Next featured movie" onClick={() => go(1)}>
              <ChevronRightIcon />
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}
