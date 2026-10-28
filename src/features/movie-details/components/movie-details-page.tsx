import { Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { FilmIcon } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/toast";
import { errorMessage, LibraryLoadError, useLibraryMovies } from "@/features/library";
import { SubtitlesCard } from "@/features/subtitles";
import type { OmdbStatus } from "../api/movie-details-api";
import { useMovieDetails } from "../hooks/use-movie-details";
import { embeddedSubtitles } from "../lib/describe-stream";
import type { MovieDetails } from "../types";
import { MediaInspector } from "./media-inspector";
import { MovieCast } from "./movie-cast";
import { MovieHero } from "./movie-hero";
import { MovieSynopsis } from "./movie-synopsis";

const omdbStatusNotes: Record<Exclude<OmdbStatus, "found">, string> = {
  "no-key": "Set OMDB_API_KEY to fetch the plot, credits and ratings.",
  pending: "Fetching the plot, credits and ratings in the background.",
  "not-found": "OMDb has no match for this title, so there is no plot, credits or ratings.",
};

export function MovieDetailsPage({ movieId }: { movieId: string }) {
  const { movies, isLoading, error, refetch } = useLibraryMovies();
  const catalogMovie = movies.find((movie) => movie.id === movieId);
  // Only movies in the catalog have details; this also keeps bad ids from reaching the backend.
  const { data: details, error: detailsError } = useMovieDetails(movieId, { enabled: catalogMovie !== undefined });

  useEffect(() => {
    if (detailsError) {
      toast.add({ title: "Couldn't load movie details", description: errorMessage(detailsError), type: "error" });
    }
  }, [detailsError]);

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
          <Link to="/movies" className={buttonVariants({ variant: "outline" })}>
            Go to movies
          </Link>
        </EmptyContent>
      </Empty>
    );
  }

  const movie: MovieDetails = { ...catalogMovie, omdb: details?.omdb, media: details?.media };
  const { omdb } = movie;

  return (
    <div className="flex flex-1 flex-col gap-6">
      <MovieHero movie={movie} />
      {details && details.omdbStatus !== "found" && (
        <p className="-mt-3 font-mono text-xs text-muted-foreground">{omdbStatusNotes[details.omdbStatus]}</p>
      )}

      <div className="grid gap-6 lg:grid-cols-12">
        <div className="flex flex-col gap-6 lg:col-span-8">
          {omdb && <MovieSynopsis omdb={omdb} />}
          {omdb && omdb.actors.length > 0 && <MovieCast actors={omdb.actors} />}
        </div>
        <div className="flex flex-col gap-6 lg:col-span-4">
          <MediaInspector movie={movie} />
          <SubtitlesCard movieId={movie.id} embedded={movie.media && embeddedSubtitles(movie.media.streams)} />
        </div>
      </div>
    </div>
  );
}
