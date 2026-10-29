import { Link } from "@tanstack/react-router";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  FilmIcon,
  InfoIcon,
  PlayIcon,
  RotateCcwIcon,
} from "lucide-react";
import { useState, useSyncExternalStore } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  ArtworkBackdrop,
  formatDuration,
  formatFileSize,
  usePlayMovie,
} from "@/features/library";
import { cn } from "@/lib/utils";
import type { BillboardItem } from "../types";

// Translucent pill buttons that read on top of artwork in both themes.
const glassButton =
  "rounded-full border-0 bg-foreground/10 text-foreground backdrop-blur-md hover:bg-foreground/20";

function BillboardSlide({ item }: { item: BillboardItem }) {
  const { movie } = item;
  const playMovie = usePlayMovie();
  const progress = Math.min(Math.max(movie.progress ?? 0, 0), 1);
  const remainingMinutes =
    movie.durationMinutes !== undefined
      ? Math.round(movie.durationMinutes * (1 - progress))
      : undefined;
  const facts = [
    movie.year,
    movie.durationMinutes !== undefined &&
      formatDuration(movie.durationMinutes),
    formatFileSize(movie.sizeBytes),
  ].filter(Boolean);

  return (
    <div className="absolute inset-0 isolate animate-in duration-700 fade-in">
      <ArtworkBackdrop
        movie={movie}
        artClassName="motion-safe:animate-billboard-zoom"
        fallback={
          <div className="absolute inset-y-0 right-0 -z-10 flex w-[60%] items-center justify-center bg-linear-to-l from-primary/15 to-transparent">
            <FilmIcon className="size-40 text-foreground/5" />
          </div>
        }
      />
      {/* Keeps text readable over the art. */}
      <div className="absolute inset-0 -z-10 bg-linear-to-t from-card via-card/30 to-transparent" />
      <div className="absolute inset-0 -z-10 bg-linear-to-r from-card/90 via-card/40 to-transparent" />

      <div className="flex h-full max-w-2xl flex-col justify-end gap-5 p-6 pb-16 md:p-12 md:pb-20">
        <span className="flex items-center gap-2 text-xs font-semibold tracking-[0.2em] text-primary uppercase">
          <span className="h-px w-6 bg-primary" />
          {item.eyebrow}
        </span>

        <h1 className="line-clamp-2 font-heading text-4xl leading-[1.05] font-bold tracking-tight text-balance drop-shadow-sm md:text-6xl">
          {movie.title}
        </h1>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
          {movie.quality && (
            <span className="rounded-md border border-foreground/25 px-1.5 py-0.5 font-mono text-[11px] font-semibold tracking-wider text-foreground uppercase">
              {movie.quality}
            </span>
          )}
          {facts.map((fact, index) => (
            <span key={index} className="flex items-center gap-3">
              {index > 0 && (
                <span
                  aria-hidden
                  className="size-1 rounded-full bg-muted-foreground/60"
                />
              )}
              {fact}
            </span>
          ))}
        </div>

        {progress > 0 && (
          <div className="flex max-w-sm items-center gap-3">
            <div className="h-1 flex-1 overflow-hidden rounded-full bg-foreground/15">
              <div
                className="h-full rounded-full bg-primary"
                style={{ width: `${progress * 100}%` }}
              />
            </div>
            <span className="shrink-0 font-mono text-xs text-muted-foreground">
              {remainingMinutes !== undefined
                ? `${formatDuration(remainingMinutes)} left`
                : `${Math.round(progress * 100)}% watched`}
            </span>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3 pt-1">
          <Button
            size="lg"
            // className="h-11 rounded-full px-7 text-base shadow-lg shadow-primary/25"
            disabled={playMovie.isPending}
            onClick={() => playMovie.mutate({ id: movie.id })}
          >
            {playMovie.isPending ? (
              <Spinner data-icon="inline-start" />
            ) : (
              <PlayIcon data-icon="inline-start" className="fill-current" />
            )}
            {progress > 0 ? "Resume" : "Play"}
          </Button>
          <Link
            to="/movies/$movieId"
            params={{ movieId: movie.id }}
            className={buttonVariants({
              size: "lg",
              variant: "outline",
            })}
          >
            <InfoIcon data-icon="inline-start" />
            More info
          </Link>
          {progress > 0 && (
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    size="icon-lg"
                    aria-label="Play from start"
                    className={cn("size-11", glassButton)}
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
  return useSyncExternalStore(
    subscribeReducedMotion,
    () => window.matchMedia(reducedMotionQuery).matches,
  );
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

  if (!active) return null;
  const go = (step: number) =>
    setActiveId(items[(activeIndex + step + count) % count].movie.id);
  // The active segment's fill animation is the slide timer: pausing it pauses rotation, and a new
  // slide remounts it, so the countdown always restarts with the slide.
  const rotates = count > 1 && !reducedMotion;
  const paused = hovered || focused;

  return (
    <section
      aria-roledescription="carousel"
      aria-label="Featured movies"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={(event) => {
        // Focus moving between the banner's own buttons is not leaving it.
        if (!event.currentTarget.contains(event.relatedTarget))
          setFocused(false);
      }}
      className="relative h-104 overflow-hidden rounded-3xl bg-card shadow-2xl shadow-black/10 ring-1 ring-foreground/10 md:h-[32rem]"
    >
      <BillboardSlide key={active.movie.id} item={active} />

      {count > 1 && (
        <div className="absolute right-6 bottom-6 left-6 flex items-center justify-between gap-4 md:right-12 md:left-12">
          <div className="flex items-center gap-2">
            {items.map((item, itemIndex) => (
              <button
                key={item.movie.id}
                type="button"
                aria-label={`Show ${item.movie.title}`}
                aria-current={itemIndex === activeIndex}
                onClick={() => setActiveId(item.movie.id)}
                className="group/segment py-2 outline-none"
              >
                <span
                  className={cn(
                    "block h-1 overflow-hidden rounded-full bg-foreground/20 transition-all group-hover/segment:bg-foreground/40 group-focus-visible/segment:ring-3 group-focus-visible/segment:ring-ring/50",
                    itemIndex === activeIndex ? "w-12" : "w-6",
                  )}
                >
                  {itemIndex === activeIndex && (
                    <span
                      key={active.movie.id}
                      onAnimationEnd={() => go(1)}
                      style={{
                        animationPlayState: paused ? "paused" : "running",
                      }}
                      className={cn(
                        "block h-full origin-left rounded-full bg-foreground",
                        rotates ? "animate-billboard-timer" : "w-full",
                      )}
                    />
                  )}
                </span>
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <Button
              size="icon"
              aria-label="Previous featured movie"
              className={glassButton}
              onClick={() => go(-1)}
            >
              <ChevronLeftIcon />
            </Button>
            <Button
              size="icon"
              aria-label="Next featured movie"
              className={glassButton}
              onClick={() => go(1)}
            >
              <ChevronRightIcon />
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}
