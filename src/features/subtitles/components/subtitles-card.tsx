import { CaptionsIcon, FilePlusIcon, SearchIcon, Trash2Icon } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { languageLabel } from "@/features/library";
import { useAddSubtitleFile } from "../hooks/use-add-subtitle-file";
import { useRemoveSubtitle } from "../hooks/use-remove-subtitle";
import { useSetSubtitleChoice } from "../hooks/use-set-subtitle-choice";
import { useSubtitles } from "../hooks/use-subtitles";
import { AUTO_CHOICE, subtitleChoice, toStoredChoice } from "../lib/subtitle-choice";
import type { EmbeddedSubtitle } from "../types";
import { SearchSubtitlesDialog } from "./search-subtitles-dialog";

function ChoiceRow({
  value,
  title,
  detail,
  badge,
  action,
}: {
  value: string;
  title: string;
  detail?: string;
  badge?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2 rounded-lg bg-muted p-3">
      <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-3">
        <RadioGroupItem value={value} />
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="flex items-center gap-1.5 text-sm font-medium">
            <span className="truncate">{title}</span>
            {badge && <Badge variant="secondary">{badge}</Badge>}
          </span>
          {detail && (
            <span className="truncate font-mono text-xs text-muted-foreground" title={detail}>
              {detail}
            </span>
          )}
        </span>
      </label>
      {action}
    </div>
  );
}

function GroupLabel({ children }: { children: React.ReactNode }) {
  return <p className="pt-2 font-mono text-[11px] tracking-wider text-muted-foreground uppercase">{children}</p>;
}

/**
 * Every subtitle a movie has (embedded, next to the file, added) as one choice list. The choice is
 * remembered and applied when mpv starts; files can be added from disk or found online.
 * `embedded` is undefined while the file's streams are not known yet (not probed, or the file
 * changed); an embedded choice then stays shown as chosen rather than as gone.
 */
export function SubtitlesCard({ movieId, embedded }: { movieId: string; embedded: EmbeddedSubtitle[] | undefined }) {
  const { data, isPending } = useSubtitles(movieId);
  const setChoice = useSetSubtitleChoice(movieId);
  const { addFile, isAdding } = useAddSubtitleFile(movieId);
  const remove = useRemoveSubtitle(movieId);
  const [searchOpen, setSearchOpen] = useState(false);

  const sidecars = data?.sidecars ?? [];
  const added = data?.added ?? [];
  const chosen = data?.choice ?? AUTO_CHOICE;
  // Streams not read yet: keep an embedded choice visible, since mpv will still be asked for it.
  const pendingEmbedded = embedded === undefined && chosen.startsWith("embedded:") ? chosen : undefined;
  const embeddedRows = embedded ?? [];
  const values = [
    AUTO_CHOICE,
    subtitleChoice.off,
    ...embeddedRows.map((subtitle) => subtitleChoice.embedded(subtitle.index)),
    ...(pendingEmbedded ? [pendingEmbedded] : []),
    ...sidecars.map((sidecar) => subtitleChoice.sidecar(sidecar.fileName)),
    ...added.map((subtitle) => subtitleChoice.added(subtitle.id)),
  ];
  // A chosen subtitle that has since gone falls back to mpv's pick at play time; show that.
  const choiceGone = !values.includes(chosen);
  const count = embeddedRows.length + sidecars.length + added.length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CaptionsIcon className="size-4 text-primary" />
          Subtitles
          {count > 0 && <Badge variant="secondary">{count}</Badge>}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {isPending ? (
          <>
            <Skeleton className="h-12 rounded-lg" />
            <Skeleton className="h-12 rounded-lg" />
          </>
        ) : (
          <RadioGroup
            aria-label="Subtitle to start with"
            value={choiceGone ? AUTO_CHOICE : chosen}
            onValueChange={(value) => setChoice.mutate(toStoredChoice(value as string))}
            className="gap-2"
          >
            <ChoiceRow value={AUTO_CHOICE} title="Automatic" detail="mpv picks, following its own settings" />
            <ChoiceRow value={subtitleChoice.off} title="Off" />

            {(embeddedRows.length > 0 || pendingEmbedded) && <GroupLabel>In the video</GroupLabel>}
            {pendingEmbedded && (
              <ChoiceRow
                value={pendingEmbedded}
                title={`Track ${pendingEmbedded.split(":")[1]}`}
                detail="Details appear once the file has been read"
              />
            )}
            {embeddedRows.map((subtitle) => (
              <ChoiceRow
                key={subtitle.index}
                value={subtitleChoice.embedded(subtitle.index)}
                title={subtitle.label}
                detail={subtitle.detail}
                badge={subtitle.isDefault ? "Default" : undefined}
              />
            ))}

            {sidecars.length > 0 && <GroupLabel>Next to the file</GroupLabel>}
            {sidecars.map((sidecar) => (
              <ChoiceRow
                key={sidecar.fileName}
                value={subtitleChoice.sidecar(sidecar.fileName)}
                title={sidecar.language ? languageLabel(sidecar.language) : "Unknown language"}
                detail={[sidecar.tags, sidecar.fileName].filter(Boolean).join(" • ")}
              />
            ))}

            {added.length > 0 && <GroupLabel>Added</GroupLabel>}
            {added.map((subtitle) => (
              <ChoiceRow
                key={subtitle.id}
                value={subtitleChoice.added(subtitle.id)}
                title={subtitle.language ? languageLabel(subtitle.language) : subtitle.label}
                detail={[subtitle.source === "opensubtitles" ? "OpenSubtitles" : "File", subtitle.label].join(" • ")}
                action={
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Remove ${subtitle.label}`}
                    title="Remove"
                    disabled={remove.isPending}
                    onClick={() => remove.mutate(subtitle.id)}
                  >
                    <Trash2Icon />
                  </Button>
                }
              />
            ))}
          </RadioGroup>
        )}
        {choiceGone && (
          <p className="font-mono text-xs text-muted-foreground">The chosen subtitle is no longer there, so mpv picks.</p>
        )}
        <p className="font-mono text-xs text-muted-foreground">Applies from the next Play. Press J in mpv to switch while watching.</p>
      </CardContent>
      <CardFooter className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={addFile} disabled={isAdding}>
          {isAdding ? <Spinner data-icon="inline-start" /> : <FilePlusIcon data-icon="inline-start" />}
          Add file
        </Button>
        <Button variant="outline" size="sm" onClick={() => setSearchOpen(true)}>
          <SearchIcon data-icon="inline-start" />
          Search online
        </Button>
      </CardFooter>
      <SearchSubtitlesDialog
        movieId={movieId}
        open={searchOpen}
        onOpenChange={setSearchOpen}
        searchEnabled={data?.searchEnabled ?? false}
      />
    </Card>
  );
}
