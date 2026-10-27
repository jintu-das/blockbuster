import { CaptionsIcon, CopyIcon, FileVideoIcon, VideoIcon, Volume2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/components/ui/toast";
import { formatFileSize } from "@/features/library";
import { codecLabel, formatBitrate, streamSummary } from "../lib/describe-stream";
import type { MediaStream, MovieDetails } from "../types";
import { SectionLabel } from "./section-label";

const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" });

const streamIcons = { video: VideoIcon, audio: Volume2Icon, subtitle: CaptionsIcon };
const streamLabels = { video: "Video", audio: "Audio", subtitle: "Subtitles" };

function StreamRow({ stream, index }: { stream: MediaStream; index: number }) {
  const Icon = streamIcons[stream.kind];
  return (
    <li className="flex flex-col gap-1 rounded-lg bg-muted p-3">
      <div className="flex items-center justify-between gap-2 font-mono text-xs">
        <span className="flex items-center gap-1.5 font-semibold">
          <Icon className="size-3.5 text-primary" />
          {streamLabels[stream.kind]} #{index}
        </span>
        <span className="text-muted-foreground">{codecLabel(stream)}</span>
      </div>
      <p className="font-mono text-xs text-muted-foreground">
        {streamSummary(stream)}
      </p>
    </li>
  );
}

export function MediaInspector({ movie }: { movie: MovieDetails }) {
  const { media } = movie;
  // Number streams per kind, as players list them: Audio #1, Audio #2, Subtitles #1.
  const kindCounts: Partial<Record<MediaStream["kind"], number>> = {};
  const numberedStreams = (media?.streams ?? []).map((stream) => {
    kindCounts[stream.kind] = (kindCounts[stream.kind] ?? 0) + 1;
    return { stream, index: kindCounts[stream.kind]! };
  });

  const copyPath = () =>
    navigator.clipboard.writeText(movie.filePath).then(
      () => toast.add({ title: "Path copied" }),
      () => toast.add({ title: "Couldn't copy the path", type: "error" }),
    );

  const timeline = [
    { label: "Added", value: dateFormat.format(new Date(movie.addedAt)) },
    { label: "Last played", value: movie.lastPlayedAt && dateFormat.format(new Date(movie.lastPlayedAt)) },
  ].filter((entry) => entry.value);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileVideoIcon className="size-4 text-primary" />
          Media info
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col gap-1 rounded-lg bg-muted p-3">
          <div className="flex items-center justify-between">
            <SectionLabel>File path</SectionLabel>
            <Button variant="ghost" size="xs" onClick={copyPath}>
              <CopyIcon data-icon="inline-start" />
              Copy
            </Button>
          </div>
          <p className="font-mono text-xs break-all select-all">{movie.filePath}</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col rounded-lg bg-muted p-3">
            <SectionLabel>Size</SectionLabel>
            <span className="font-mono text-base font-semibold">{formatFileSize(movie.sizeBytes)}</span>
            <span className="font-mono text-[11px] text-muted-foreground">
              {movie.sizeBytes.toLocaleString()} bytes
            </span>
          </div>
          {media?.container && (
            <div className="flex flex-col rounded-lg bg-muted p-3">
              <SectionLabel>Container</SectionLabel>
              <span className="font-mono text-base font-semibold">{media.container}</span>
              {media.bitrateKbps !== null && (
                <span className="font-mono text-[11px] text-muted-foreground">{formatBitrate(media.bitrateKbps)}</span>
              )}
            </div>
          )}
        </div>

        {numberedStreams.length > 0 && (
          <div className="flex flex-col gap-2">
            <SectionLabel>Streams</SectionLabel>
            <ul className="flex flex-col gap-2">
              {numberedStreams.map(({ stream, index }) => (
                <StreamRow key={`${stream.kind}-${index}`} stream={stream} index={index} />
              ))}
            </ul>
          </div>
        )}

        <dl className="flex flex-col gap-2 border-t pt-3 font-mono text-xs">
          {timeline.map((entry) => (
            <div key={entry.label} className="flex items-center justify-between gap-4">
              <dt className="text-muted-foreground">{entry.label}</dt>
              <dd>{entry.value}</dd>
            </div>
          ))}
        </dl>
      </CardContent>
    </Card>
  );
}
