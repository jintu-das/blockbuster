import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { useArtwork } from "../hooks/use-artwork";
import { useThumbnail } from "../hooks/use-thumbnail";
import type { Movie } from "../types";

/**
 * A movie's art as a banner background, for the Home billboard and the details hero: a blurred
 * colour wash over the whole banner, and the sharp art on the right fading into it on the left.
 * Place it inside a `relative isolate` container; it paints at `-z-20`, clipped to that container,
 * so callers add their own readability overlays above it. Renders `fallback` while the movie has
 * no art.
 */
export function ArtworkBackdrop({
  movie,
  fallback = null,
  artClassName,
}: {
  movie: Pick<Movie, "id" | "thumbnailFile">;
  fallback?: ReactNode;
  /** Extra classes for the sharp image, e.g. a zoom animation. */
  artClassName?: string;
}) {
  const thumbnail = useThumbnail(movie);
  const artwork = useArtwork(movie);
  if (!artwork) return fallback;

  return (
    // WebKitGTK does not clip a composited child (the blur below) to a plain `overflow-hidden`
    // parent, so the wash bled over the whole page. A composited clip of our own (`transform-gpu`)
    // is honoured; `rounded-[inherit]` keeps the banner's corners.
    <div className="absolute inset-0 -z-20 overflow-hidden rounded-[inherit] transform-gpu">
      {/* Blurred, the small thumbnail looks the same as the large art and decodes far faster;
          its own compositor layer keeps the blur from being recomputed on every repaint. */}
      <img
        src={thumbnail ?? artwork}
        alt=""
        className="absolute inset-0 size-full scale-125 object-cover opacity-35 blur-3xl saturate-150 will-change-transform"
      />
      <div className="absolute inset-y-0 right-0 w-full overflow-hidden mask-[linear-gradient(to_left,black_40%,transparent)] md:w-[68%] md:mask-[linear-gradient(to_left,black_55%,transparent)]">
        <img src={artwork} alt="" className={cn("size-full object-cover object-[center_25%]", artClassName)} />
      </div>
    </div>
  );
}
