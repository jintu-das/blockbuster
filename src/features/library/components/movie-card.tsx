import { FilmIcon } from "lucide-react";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatDuration } from "../lib/format-duration";
import type { Movie } from "../types";

export function MovieCard({ movie }: { movie: Movie }) {
  return (
    <Card size="sm" className="pt-0">
      <AspectRatio ratio={16 / 9} className="bg-muted">
        {movie.thumbnail ? (
          <img
            src={movie.thumbnail}
            alt=""
            className="size-full object-cover"
          />
        ) : (
          <div className="flex size-full items-center justify-center text-muted-foreground">
            <FilmIcon className="size-8" />
          </div>
        )}
        <Badge variant="secondary" className="absolute right-2 bottom-2">
          {formatDuration(movie.durationMinutes)}
        </Badge>
      </AspectRatio>
      <CardHeader>
        <CardTitle className="truncate" title={movie.title}>
          {movie.title}
        </CardTitle>
        <CardDescription>{movie.year}</CardDescription>
      </CardHeader>
    </Card>
  );
}
