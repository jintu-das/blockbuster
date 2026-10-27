import { Link } from "@tanstack/react-router";
import { FilmIcon } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { LibraryLoadError, useLibraryMovies } from "@/features/library";
import { mockMovieMetadata } from "../data/mock-movie-details";
import type { MovieDetails } from "../types";
import { MediaInspector } from "./media-inspector";
import { MovieCast } from "./movie-cast";
import { MovieHero } from "./movie-hero";
import { MovieSynopsis } from "./movie-synopsis";

export function MovieDetailsPage({ movieId }: { movieId: string }) {
  const { movies, isLoading, error, refetch } = useLibraryMovies();
  const catalogMovie = movies.find((movie) => movie.id === movieId);

  if (error) return <LibraryLoadError error={error} onRetry={refetch} />;
  if (isLoading) return <Skeleton className="h-[420px] rounded-xl" />;
  // The catalog lists only movies still on disk, so a missing file lands here too.
  if (!catalogMovie) {
    return (
      <Empty className="flex-1 border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <FilmIcon />
          </EmptyMedia>
          <EmptyTitle>Movie not found</EmptyTitle>
          <EmptyDescription>It may have been moved or deleted from your library folder.</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Link to="/library" className={buttonVariants({ variant: "outline" })}>
            Go to library
          </Link>
        </EmptyContent>
      </Empty>
    );
  }

  const movie: MovieDetails = { ...catalogMovie, ...mockMovieMetadata };
  const { omdb } = movie;

  return (
    <div className="flex flex-1 flex-col gap-6">
      <MovieHero movie={movie} />
      <p className="-mt-3 font-mono text-xs text-muted-foreground">
        Plot, credits, ratings and stream details are sample data until metadata is stored.
      </p>

      <div className="grid gap-6 lg:grid-cols-12">
        <div className="flex flex-col gap-6 lg:col-span-8">
          {omdb && <MovieSynopsis omdb={omdb} />}
          {omdb && omdb.actors.length > 0 && <MovieCast actors={omdb.actors} />}
        </div>
        <div className="lg:col-span-4">
          <MediaInspector movie={movie} />
        </div>
      </div>
    </div>
  );
}
