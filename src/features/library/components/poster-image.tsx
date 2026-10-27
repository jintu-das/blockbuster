import { FilmIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/** A poster or frame filling its container, or a film icon (and title) while there is none. */
export function PosterImage({ src, title, className }: { src?: string; title?: string; className?: string }) {
  if (src) return <img src={src} alt="" className={cn("size-full object-cover", className)} />;
  return (
    <div className="flex size-full flex-col items-center justify-center gap-3 p-4 text-center text-muted-foreground">
      <FilmIcon className="size-10" />
      {title && <span className="line-clamp-2 font-heading text-sm font-medium">{title}</span>}
    </div>
  );
}
