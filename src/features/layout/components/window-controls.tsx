import { getCurrentWindow } from "@tauri-apps/api/window";
import { CopyIcon, MinusIcon, SquareIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useIsMaximized } from "../hooks/use-is-maximized";

// The window has no system title bar (`decorations: false`), so the header draws these.
export function WindowControls({ className }: { className?: string }) {
  const isMaximized = useIsMaximized();
  const appWindow = getCurrentWindow();

  return (
    <div className={cn("flex items-center gap-1", className)}>
      <Button
        variant="ghost"
        size="icon-sm"
        className="rounded-full"
        aria-label="Minimize"
        onClick={() => appWindow.minimize()}
      >
        <MinusIcon />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        className="rounded-full"
        aria-label={isMaximized ? "Restore" : "Maximize"}
        onClick={() => appWindow.toggleMaximize()}
      >
        {isMaximized ? <CopyIcon className="-scale-x-100" /> : <SquareIcon />}
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        className="rounded-full hover:bg-destructive hover:text-white dark:hover:bg-destructive"
        aria-label="Close"
        onClick={() => appWindow.close()}
      >
        <XIcon />
      </Button>
    </div>
  );
}
