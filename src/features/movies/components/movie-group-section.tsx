import { ChevronRightIcon } from "lucide-react";
import { formatFileSize, formatMovieCount } from "@/features/library";
import { cn } from "@/lib/utils";
import type { MovieGroup } from "../lib/group-movies";

export function MovieGroupSection({
  group,
  collapsed,
  onToggle,
  children,
}: {
  group: MovieGroup;
  collapsed: boolean;
  /** Called with the group's key, so callers can pass one stable handler to every section. */
  onToggle: (key: string) => void;
  children: React.ReactNode;
}) {
  const totalBytes = group.movies.reduce((sum, movie) => sum + movie.sizeBytes, 0);

  return (
    <section className="flex flex-col gap-3">
      <button
        type="button"
        aria-expanded={!collapsed}
        onClick={() => onToggle(group.key)}
        className="group/header flex items-center gap-2 self-start rounded-md text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <ChevronRightIcon
          className={cn("size-4 text-muted-foreground transition-transform", !collapsed && "rotate-90")}
        />
        <h2 className="font-heading text-lg font-semibold tracking-tight group-hover/header:underline">
          {group.label}
        </h2>
        <span className="font-mono text-xs text-muted-foreground">
          {formatMovieCount(group.movies.length)} • {formatFileSize(totalBytes)}
        </span>
      </button>
      {!collapsed && children}
    </section>
  );
}
