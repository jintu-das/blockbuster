import { DownloadIcon, KeyRoundIcon, SearchXIcon } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { errorMessage, languageLabel } from "@/features/library";
import { SEARCH_LANGUAGES } from "../data/search-languages";
import { useDownloadSubtitle } from "../hooks/use-download-subtitle";
import { useSearchSubtitles } from "../hooks/use-search-subtitles";

const languageItems = Object.fromEntries(SEARCH_LANGUAGES.map((code) => [code, languageLabel(code)]));

/** The system language if OpenSubtitles has it ("pt-br", else "pt"), otherwise English. */
function defaultLanguage() {
  const system = navigator.language.toLowerCase();
  const base = system.split("-")[0];
  return [system, base].find((code) => SEARCH_LANGUAGES.includes(code)) ?? "en";
}

/** Searches OpenSubtitles for a movie in one language and downloads a result into the app. */
export function SearchSubtitlesDialog({
  movieId,
  open,
  onOpenChange,
  searchEnabled,
}: {
  movieId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  searchEnabled: boolean;
}) {
  const [language, setLanguage] = useState(defaultLanguage);
  const search = useSearchSubtitles(movieId, language, { enabled: open && searchEnabled });
  const download = useDownloadSubtitle(movieId);
  const results = search.data ?? [];

  let body: React.ReactNode;
  if (!searchEnabled) {
    body = (
      <Empty className="border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <KeyRoundIcon />
          </EmptyMedia>
          <EmptyTitle>Online search is off</EmptyTitle>
          <EmptyDescription>
            Get a free API key at opensubtitles.com, then start the app with OPENSUBTITLES_API_KEY set.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  } else if (search.isPending) {
    body = (
      <div className="flex flex-col gap-2">
        {[0, 1, 2].map((row) => (
          <Skeleton key={row} className="h-14 rounded-lg" />
        ))}
      </div>
    );
  } else if (search.error) {
    body = (
      <Empty className="border">
        <EmptyHeader>
          <EmptyTitle>Search failed</EmptyTitle>
          <EmptyDescription>{errorMessage(search.error)}</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button variant="outline" size="sm" onClick={() => void search.refetch()}>
            Try again
          </Button>
        </EmptyContent>
      </Empty>
    );
  } else if (results.length === 0) {
    body = (
      <Empty className="border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <SearchXIcon />
          </EmptyMedia>
          <EmptyTitle>No subtitles found</EmptyTitle>
          <EmptyDescription>Nothing in {languageLabel(language)} yet. Try another language.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  } else {
    body = (
      <ul className="flex max-h-96 flex-col gap-2 overflow-y-auto">
        {results.map((result) => {
          const downloading = download.isPending && download.variables?.fileId === result.fileId;
          return (
            <li key={result.fileId} className="flex items-center gap-3 rounded-lg bg-muted p-3">
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="truncate text-sm font-medium" title={result.release}>
                  {result.release}
                </span>
                <span className="flex flex-wrap items-center gap-1.5 font-mono text-xs text-muted-foreground">
                  {result.hashMatch && <Badge>Exact match</Badge>}
                  {result.hearingImpaired && <Badge variant="secondary">SDH</Badge>}
                  {result.downloads.toLocaleString()} downloads
                </span>
              </div>
              <Button
                variant="outline"
                size="sm"
                disabled={download.isPending}
                onClick={() => download.mutate(result, { onSuccess: () => onOpenChange(false) })}
              >
                {downloading ? <Spinner data-icon="inline-start" /> : <DownloadIcon data-icon="inline-start" />}
                Download
              </Button>
            </li>
          );
        })}
      </ul>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Search OpenSubtitles</DialogTitle>
          <DialogDescription>Subtitles made for this exact file are listed first.</DialogDescription>
        </DialogHeader>
        {searchEnabled && (
          <Select items={languageItems} value={language} onValueChange={(value) => value && setLanguage(value)}>
            <SelectTrigger className="w-56" aria-label="Language">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {SEARCH_LANGUAGES.map((code) => (
                  <SelectItem key={code} value={code}>
                    {languageItems[code]}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        )}
        {body}
      </DialogContent>
    </Dialog>
  );
}
