import { ClockIcon, FilmIcon, HardDriveIcon, PlayIcon, type LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { formatFileSize, type Movie } from "@/features/library";

function Stat({ icon: Icon, value, label }: { icon: LucideIcon; value: string; label: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
        <Icon />
      </div>
      <div className="flex min-w-0 flex-col">
        <span className="font-heading text-base font-semibold">{value}</span>
        <span className="truncate font-mono text-xs text-muted-foreground uppercase">{label}</span>
      </div>
    </div>
  );
}

export function LibraryStats({ movies }: { movies: Movie[] }) {
  const movieCount = movies.length;
  const totalSizeBytes = movies.reduce((sum, movie) => sum + movie.sizeBytes, 0);
  const totalMinutes = movies.reduce((sum, movie) => sum + movie.durationMinutes, 0);
  const inProgressCount = movies.filter((movie) => (movie.progress ?? 0) > 0).length;

  return (
    <Card>
      <CardContent className="grid grid-cols-2 gap-6 md:grid-cols-4">
        <Stat icon={FilmIcon} value={String(movieCount)} label="Movies" />
        <Stat icon={HardDriveIcon} value={formatFileSize(totalSizeBytes)} label="On disk" />
        <Stat icon={ClockIcon} value={`${Math.round(totalMinutes / 60)}h`} label="Total runtime" />
        <Stat icon={PlayIcon} value={String(inProgressCount)} label="In progress" />
      </CardContent>
    </Card>
  );
}
