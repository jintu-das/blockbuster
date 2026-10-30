import { RefreshCwIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Spinner } from "@/components/ui/spinner";
import {
  useChooseLibraryFolder,
  useLibraryBusy,
  useLibraryFolder,
  useScanLibrary,
} from "@/features/library";
import { ThemeToggle } from "@/features/theme";
import { HeaderSearch } from "./header-search";
import { WindowControls } from "./window-controls";

export function AppHeader() {
  const folderQuery = useLibraryFolder();
  const scanLibrary = useScanLibrary();
  const chooseFolder = useChooseLibraryFolder();
  const isScanning = useLibraryBusy();
  // Only a loaded `null` means "no folder yet". While loading the button waits, and if the
  // folder can't be read we still scan, so the backend reports the real problem.
  const hasNoFolder = folderQuery.data === null;

  return (
    // The header doubles as the title bar: its empty space drags the window, and a
    // double-click maximizes. Tauri only reacts to the marked element, not its children.
    <header
      data-tauri-drag-region
      className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-2 border-b bg-background px-4 select-none"
    >
      <SidebarTrigger />
      <Separator
        orientation="vertical"
        className="mr-2 data-vertical:h-4 data-vertical:self-auto"
      />

      <HeaderSearch />

      <div data-tauri-drag-region className="h-full flex-1" />

      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          disabled={isScanning || folderQuery.isPending}
          onClick={() => (hasNoFolder ? chooseFolder() : scanLibrary.mutate())}
        >
          {isScanning ? (
            <Spinner data-icon="inline-start" />
          ) : (
            <RefreshCwIcon data-icon="inline-start" />
          )}
          {isScanning ? "Scanning..." : "Scan library"}
        </Button>

        <ThemeToggle />
      </div>

      <Separator
        orientation="vertical"
        className="mx-1 data-vertical:h-4 data-vertical:self-auto"
      />
      <WindowControls />
    </header>
  );
}
