import { useLocation, useNavigate, useSearch } from "@tanstack/react-router";
import { BellIcon, RefreshCwIcon, SearchIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@/components/ui/input-group";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Spinner } from "@/components/ui/spinner";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useChooseLibraryFolder, useLibraryBusy, useLibraryFolder, useScanLibrary } from "@/features/library";
import { ThemeToggle } from "@/features/theme";

export function AppHeader() {
  const folderQuery = useLibraryFolder();
  const scanLibrary = useScanLibrary();
  const chooseFolder = useChooseLibraryFolder();
  const isScanning = useLibraryBusy();
  // Only a loaded `null` means "no folder yet". While loading the button waits, and if the
  // folder can't be read we still scan, so the backend reports the real problem.
  const hasNoFolder = folderQuery.data === null;

  // The search box drives the Movies page's title filter (`q` in its URL). Typing elsewhere
  // opens Movies; once there, each keystroke replaces the entry instead of adding history.
  const navigate = useNavigate();
  const onMoviesPage = useLocation({ select: (location) => location.pathname.replace(/\/$/, "") === "/movies" });
  const query = useSearch({ strict: false, select: (search) => ("q" in search ? search.q : undefined) });
  const search = (q: string) =>
    navigate({
      to: "/movies",
      search: (previous) => ({ ...(onMoviesPage ? previous : {}), q: q || undefined }),
      replace: onMoviesPage,
    });

  return (
    <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-2 border-b bg-background px-4">
      <SidebarTrigger />
      <Separator orientation="vertical" className="mr-2 data-vertical:h-4 data-vertical:self-auto" />

      <InputGroup className="max-w-md">
        <InputGroupAddon>
          <SearchIcon />
        </InputGroupAddon>
        <InputGroupInput
          type="search"
          placeholder="Search movies..."
          aria-label="Search movies"
          value={onMoviesPage ? (query ?? "") : ""}
          onChange={(event) => search(event.target.value)}
        />
        {onMoviesPage && query && (
          <InputGroupAddon align="inline-end">
            <InputGroupButton size="icon-xs" aria-label="Clear search" onClick={() => search("")}>
              <XIcon />
            </InputGroupButton>
          </InputGroupAddon>
        )}
      </InputGroup>

      <div className="ml-auto flex items-center gap-1">
        <Button
          variant="outline"
          disabled={isScanning || folderQuery.isPending}
          onClick={() => (hasNoFolder ? chooseFolder() : scanLibrary.mutate())}
        >
          {isScanning ? <Spinner data-icon="inline-start" /> : <RefreshCwIcon data-icon="inline-start" />}
          {isScanning ? "Scanning..." : "Scan library"}
        </Button>

        <Tooltip>
          <TooltipTrigger render={<Button variant="ghost" size="icon" aria-label="Notifications" />}>
            <BellIcon />
          </TooltipTrigger>
          <TooltipContent>Notifications</TooltipContent>
        </Tooltip>

        <ThemeToggle />
      </div>
    </header>
  );
}
