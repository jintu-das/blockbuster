import { BellIcon, RefreshCwIcon, SearchIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ThemeToggle } from "@/features/theme";

export function AppHeader() {
  return (
    <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-2 border-b bg-background px-4">
      <SidebarTrigger />
      <Separator orientation="vertical" className="mr-2 data-vertical:h-4 data-vertical:self-auto" />

      <InputGroup className="max-w-md">
        <InputGroupAddon>
          <SearchIcon />
        </InputGroupAddon>
        <InputGroupInput type="search" placeholder="Search movies..." aria-label="Search movies" />
      </InputGroup>

      <div className="ml-auto flex items-center gap-1">
        <Button variant="outline">
          <RefreshCwIcon data-icon="inline-start" />
          Scan library
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
