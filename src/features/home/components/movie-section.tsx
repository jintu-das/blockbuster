import { MovieGrid, type Movie } from "@/features/library";
import { SectionHeader } from "./section-header";

export function MovieSection({
  title,
  description,
  action,
  movies,
  showRating,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  movies: Movie[];
  showRating?: boolean;
}) {
  if (movies.length === 0) return null;

  return (
    <section className="flex flex-col gap-4">
      <SectionHeader title={title} description={description} action={action} />
      <MovieGrid movies={movies} showRating={showRating} />
    </section>
  );
}
