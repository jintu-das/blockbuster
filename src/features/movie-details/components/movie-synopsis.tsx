import { TrophyIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { OmdbMetadata } from "../types";
import { SectionLabel } from "./section-label";

export function MovieSynopsis({ omdb }: { omdb: OmdbMetadata }) {
  const credits = [
    { label: omdb.directors.length > 1 ? "Directors" : "Director", names: omdb.directors },
    { label: "Writers", names: omdb.writers },
  ].filter((credit) => credit.names.length > 0);

  return (
    <Card>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <SectionLabel>Synopsis</SectionLabel>
          <div className="flex flex-wrap gap-1.5">
            {omdb.genres.map((genre, index) => (
              <Badge key={genre} variant={index === 0 ? "default" : "secondary"} className="font-mono">
                {genre}
              </Badge>
            ))}
          </div>
        </div>

        {omdb.plot && <p className="text-base leading-relaxed">{omdb.plot}</p>}

        {credits.length > 0 && (
          <div className="grid gap-3 sm:grid-cols-2">
            {credits.map((credit) => (
              <div key={credit.label} className="flex flex-col gap-0.5 rounded-lg bg-muted p-3">
                <SectionLabel>{credit.label}</SectionLabel>
                <span className="font-heading font-semibold">{credit.names.join(", ")}</span>
              </div>
            ))}
          </div>
        )}

        {omdb.awards && (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <TrophyIcon className="size-4 shrink-0" />
            {omdb.awards}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
