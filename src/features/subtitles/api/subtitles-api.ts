import { invoke } from "@tauri-apps/api/core";
import type { AddedSubtitle, MovieSubtitles, SidecarSubtitle, SubtitleResult } from "../types";

/** Shape of an added subtitle from the backend (`store::AddedSubtitle`; `addedAt` in Unix seconds). */
type AddedSubtitleDto = {
  id: number;
  label: string;
  language: string | null;
  source: AddedSubtitle["source"];
  addedAt: number;
};

/** Shape returned by `list_subtitles`. */
type SubtitlesDto = {
  sidecars: { fileName: string; language: string | null; format: string; tags: string | null }[];
  added: AddedSubtitleDto[];
  choice: string | null;
  searchEnabled: boolean;
};

type SubtitleResultDto = Omit<SubtitleResult, "language"> & { language: string | null };

/** Shape returned by `download_subtitle`. */
type DownloadedSubtitleDto = { subtitle: AddedSubtitleDto; remaining: number | null; alreadyAdded: boolean };

export type DownloadedSubtitle = { subtitle: AddedSubtitle; remaining?: number; alreadyAdded: boolean };

function toAdded(dto: AddedSubtitleDto): AddedSubtitle {
  return {
    id: dto.id,
    label: dto.label,
    language: dto.language ?? undefined,
    source: dto.source,
    addedAt: new Date(dto.addedAt * 1000).toISOString(),
  };
}

function toSidecar(dto: SubtitlesDto["sidecars"][number]): SidecarSubtitle {
  return { fileName: dto.fileName, language: dto.language ?? undefined, format: dto.format, tags: dto.tags ?? undefined };
}

export const subtitlesApi = {
  list: async (movieId: string): Promise<MovieSubtitles> => {
    const dto = await invoke<SubtitlesDto>("list_subtitles", { movieId: Number(movieId) });
    return {
      sidecars: dto.sidecars.map(toSidecar),
      added: dto.added.map(toAdded),
      choice: dto.choice ?? undefined,
      searchEnabled: dto.searchEnabled,
    };
  },
  /** `undefined` lets mpv decide. */
  setChoice: (movieId: string, choice: string | undefined) =>
    invoke<void>("set_subtitle_choice", { movieId: Number(movieId), choice: choice ?? null }),
  addFile: async (movieId: string, path: string) =>
    toAdded(await invoke<AddedSubtitleDto>("add_subtitle_file", { movieId: Number(movieId), path })),
  remove: (subtitleId: number) => invoke<void>("remove_subtitle", { subtitleId }),
  search: async (movieId: string, languages: string[]): Promise<SubtitleResult[]> => {
    const results = await invoke<SubtitleResultDto[]>("search_subtitles", { movieId: Number(movieId), languages });
    return results.map((result) => ({ ...result, language: result.language ?? undefined }));
  },
  download: async (movieId: string, result: SubtitleResult): Promise<DownloadedSubtitle> => {
    const dto = await invoke<DownloadedSubtitleDto>("download_subtitle", {
      movieId: Number(movieId),
      fileId: result.fileId,
      release: result.release,
      language: result.language ?? null,
    });
    return { subtitle: toAdded(dto.subtitle), remaining: dto.remaining ?? undefined, alreadyAdded: dto.alreadyAdded };
  },
};

/** Kept outside `libraryKeys.all`, so subtitle work never shows the library as busy. */
export const subtitleKeys = {
  of: (movieId: string) => ["subtitles", movieId] as const,
  search: (movieId: string, language: string) => ["subtitles", movieId, "search", language] as const,
};
