import { ArrowDownUpIcon, ChevronDownIcon, LayoutGridIcon, ListIcon, RowsIcon, XIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { clearNarrowing, DEFAULT_SORT, GROUP_OPTIONS, RESOLUTIONS, SORT_OPTIONS, STATUS_OPTIONS } from "../lib/movie-filters";
import type { GenreOption, MovieFilters, Resolution } from "../types";

type FilterBarProps = {
  filters: MovieFilters;
  onChange: (filters: MovieFilters) => void;
  /** Decades that have at least one movie, newest first. */
  decades: number[];
  /** Genres that have at least one movie, A–Z, with how many movies each has. */
  genres: GenreOption[];
};

function FilterTrigger({ label, count }: { label: string; count?: number }) {
  return (
    <>
      {label}
      {count ? (
        <Badge className="h-4 min-w-4 px-1 font-mono text-[10px]">{count}</Badge>
      ) : null}
      <ChevronDownIcon data-icon="inline-end" />
    </>
  );
}

export function MovieFilterBar({ filters, onChange, decades, genres }: FilterBarProps) {
  const update = (patch: Partial<MovieFilters>) => onChange({ ...filters, ...patch });
  const qualityCount = (filters.quality?.length ?? 0) + (filters.hdr ? 1 : 0);
  const toggleResolution = (resolution: Resolution, checked: boolean) => {
    const quality = filters.quality ?? [];
    update({ quality: checked ? [...quality, resolution] : quality.filter((value) => value !== resolution) });
  };
  const toggleGenre = (genre: string, checked: boolean) => {
    const selected = filters.genre ?? [];
    update({ genre: checked ? [...selected, genre] : selected.filter((value) => value !== genre) });
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div role="group" aria-label="Watch status" className="flex rounded-lg bg-muted p-0.5">
        {STATUS_OPTIONS.map((option) => {
          const active = filters.status === option.value;
          return (
            <button
              key={option.label}
              type="button"
              aria-pressed={active}
              onClick={() => update({ status: option.value })}
              className={cn(
                "rounded-md px-3 py-1 text-sm font-medium text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50",
                active && "bg-background text-foreground shadow-sm",
              )}
            >
              {option.label}
            </button>
          );
        })}
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="outline" size="sm" />}>
          <FilterTrigger label="Quality" count={qualityCount} />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-44">
          <DropdownMenuGroup>
            <DropdownMenuLabel>Resolution</DropdownMenuLabel>
            {RESOLUTIONS.map((resolution) => (
              <DropdownMenuCheckboxItem
                key={resolution}
                checked={filters.quality?.includes(resolution) ?? false}
                onCheckedChange={(checked) => toggleResolution(resolution, checked)}
              >
                {resolution}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuCheckboxItem
            checked={filters.hdr ?? false}
            onCheckedChange={(checked) => update({ hdr: checked || undefined })}
          >
            HDR only
          </DropdownMenuCheckboxItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="outline" size="sm" />}>
          <FilterTrigger label={filters.decade !== undefined ? `${filters.decade}s` : "Decade"} />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-40">
          <DropdownMenuRadioGroup
            value={filters.decade ?? "any"}
            onValueChange={(value) => update({ decade: value === "any" ? undefined : Number(value) })}
          >
            <DropdownMenuRadioItem value="any">Any year</DropdownMenuRadioItem>
            {decades.map((decade) => (
              <DropdownMenuRadioItem key={decade} value={decade}>
                {decade}s
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="outline" size="sm" />}>
          <FilterTrigger label="Genre" count={filters.genre?.length} />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="max-h-80 w-56">
          <DropdownMenuGroup>
            {genres.length === 0 ? (
              <DropdownMenuLabel className="text-xs font-normal">
                No genres yet: they come from OMDb, which needs an API key.
              </DropdownMenuLabel>
            ) : (
              genres.map(({ name, count }) => (
                <DropdownMenuCheckboxItem
                  key={name}
                  checked={filters.genre?.includes(name) ?? false}
                  onCheckedChange={(checked) => toggleGenre(name, checked)}
                >
                  {name}
                  <span className="ml-auto font-mono text-xs text-muted-foreground">{count}</span>
                </DropdownMenuCheckboxItem>
              ))
            )}
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="ghost" size="sm" className="ml-auto" />}>
          <RowsIcon data-icon="inline-start" />
          {filters.group ? `By ${GROUP_OPTIONS.find((option) => option.value === filters.group)?.label.toLowerCase()}` : "Group"}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuGroup>
            <DropdownMenuLabel>Group by</DropdownMenuLabel>
            <DropdownMenuRadioGroup
              value={filters.group ?? "none"}
              onValueChange={(value) => update({ group: value === "none" ? undefined : value })}
            >
              {GROUP_OPTIONS.map((option) => (
                <DropdownMenuRadioItem key={option.label} value={option.value ?? "none"}>
                  {option.label}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="ghost" size="sm" />}>
          <ArrowDownUpIcon data-icon="inline-start" />
          {SORT_OPTIONS.find((option) => option.value === (filters.sort ?? DEFAULT_SORT))?.label}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuRadioGroup
            value={filters.sort ?? DEFAULT_SORT}
            onValueChange={(value) => update({ sort: value })}
          >
            {SORT_OPTIONS.map((option) => (
              <DropdownMenuRadioItem key={option.value} value={option.value}>
                {option.label}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      <div role="group" aria-label="View" className="flex rounded-lg bg-muted p-0.5">
        {(
          [
            { value: "grid", label: "Poster grid", Icon: LayoutGridIcon },
            { value: "list", label: "List", Icon: ListIcon },
          ] as const
        ).map(({ value, label, Icon }) => {
          const active = (filters.view ?? "grid") === value;
          return (
            <button
              key={value}
              type="button"
              aria-label={label}
              aria-pressed={active}
              title={label}
              onClick={() => update({ view: value })}
              className={cn(
                "flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50",
                active && "bg-background text-foreground shadow-sm",
              )}
            >
              <Icon className="size-4" />
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** One removable chip per active filter, plus "Clear all". */
export function ActiveFilterChips({ filters, onChange }: Omit<FilterBarProps, "decades" | "genres">) {
  const chips: { label: string; clear: Partial<MovieFilters> }[] = [];
  const query = filters.q?.trim();
  if (query) chips.push({ label: `“${query}”`, clear: { q: undefined } });
  const status = STATUS_OPTIONS.find((option) => option.value && option.value === filters.status);
  if (status) chips.push({ label: status.label, clear: { status: undefined } });
  for (const resolution of filters.quality ?? []) {
    chips.push({ label: resolution, clear: { quality: filters.quality?.filter((value) => value !== resolution) } });
  }
  if (filters.hdr) chips.push({ label: "HDR", clear: { hdr: undefined } });
  if (filters.decade !== undefined) chips.push({ label: `${filters.decade}s`, clear: { decade: undefined } });
  for (const genre of filters.genre ?? []) {
    chips.push({ label: genre, clear: { genre: filters.genre?.filter((value) => value !== genre) } });
  }

  if (chips.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {chips.map((chip) => (
        <Badge key={chip.label} variant="secondary" className="h-6 gap-1 pr-1">
          {chip.label}
          <button
            type="button"
            aria-label={`Remove ${chip.label}`}
            onClick={() => onChange({ ...filters, ...chip.clear })}
            className="rounded-full p-0.5 hover:bg-foreground/10"
          >
            <XIcon className="size-3" />
          </button>
        </Badge>
      ))}
      <Button
        variant="link"
        size="xs"
        onClick={() => onChange(clearNarrowing(filters))}
        className="text-muted-foreground"
      >
        Clear all
      </Button>
    </div>
  );
}
