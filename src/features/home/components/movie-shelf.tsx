import { Link, type LinkProps } from "@tanstack/react-router";
import { ArrowRightIcon, ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { useRef } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { MovieCard, type Movie } from "@/features/library";

/** A titled, horizontally scrolling row of posters, as on streaming home screens. */
export function MovieShelf({
  title,
  description,
  movies,
  viewAll,
}: {
  title: string;
  description?: string;
  movies: Movie[];
  /** Where "View all" goes, usually the Movies page with matching filters. */
  viewAll?: Pick<LinkProps, "to" | "search">;
}) {
  const scroller = useRef<HTMLUListElement>(null);
  if (movies.length === 0) return null;

  const scroll = (direction: 1 | -1) => {
    const element = scroller.current;
    element?.scrollBy({ left: direction * element.clientWidth * 0.9, behavior: "smooth" });
  };

  return (
    <section className="group/shelf flex flex-col gap-3">
      <div className="flex items-end justify-between gap-4">
        <div className="flex min-w-0 items-baseline gap-3">
          <h2 className="font-heading text-xl font-semibold tracking-tight">{title}</h2>
          {description && <span className="truncate font-mono text-xs text-muted-foreground">{description}</span>}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {viewAll && (
            <Link {...viewAll} className={buttonVariants({ variant: "ghost", size: "sm" })}>
              View all
              <ArrowRightIcon data-icon="inline-end" />
            </Link>
          )}
          <Button variant="outline" size="icon-sm" aria-label={`Scroll ${title} back`} onClick={() => scroll(-1)}>
            <ChevronLeftIcon />
          </Button>
          <Button variant="outline" size="icon-sm" aria-label={`Scroll ${title} forward`} onClick={() => scroll(1)}>
            <ChevronRightIcon />
          </Button>
        </div>
      </div>
      {/* Negative margin plus padding keeps the cards' hover lift and shadow from being clipped. */}
      <ul
        ref={scroller}
        className="no-scrollbar -mx-2 flex snap-x snap-mandatory scroll-px-2 gap-4 overflow-x-auto px-2 pt-2 pb-4"
      >
        {movies.map((movie) => (
          <li key={movie.id} className="w-40 shrink-0 snap-start lg:w-44">
            <MovieCard movie={movie} />
          </li>
        ))}
      </ul>
    </section>
  );
}
