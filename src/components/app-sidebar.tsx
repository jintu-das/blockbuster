import { Link, useRouterState } from "@tanstack/react-router";
import { ClapperboardIcon, FolderOpenIcon, HardDriveIcon, HouseIcon } from "lucide-react";
import { Progress, ProgressLabel, ProgressValue } from "@/components/ui/progress";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

const navItems = [
  { title: "Home", to: "/", icon: HouseIcon },
  { title: "Libraries", to: "/libraries", icon: FolderOpenIcon },
] as const;

// Placeholder until disk usage is read from the backend.
const diskUsage = { usedGb: 312, totalGb: 500 };

export function AppSidebar() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  return (
    <Sidebar>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" render={<Link to="/" />}>
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <ClapperboardIcon />
              </div>
              <div className="flex flex-col gap-0.5 leading-none">
                <span className="font-heading font-semibold">Blockbuster</span>
                <span className="text-xs text-muted-foreground">Local movie library</span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Browse</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.to}>
                  <SidebarMenuButton isActive={pathname === item.to} render={<Link to={item.to} />}>
                    <item.icon />
                    <span>{item.title}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <div className="flex flex-col gap-3 rounded-lg border bg-background p-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            <HardDriveIcon className="text-muted-foreground" />
            Storage
          </div>
          <Progress value={(diskUsage.usedGb / diskUsage.totalGb) * 100}>
            <ProgressLabel className="text-xs text-muted-foreground">
              {diskUsage.usedGb} GB of {diskUsage.totalGb} GB used
            </ProgressLabel>
            <ProgressValue className="ml-auto text-xs" />
          </Progress>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
