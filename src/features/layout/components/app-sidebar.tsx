import { Link, useMatchRoute, useSearch } from "@tanstack/react-router";
import { useMemo } from "react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";
import { useLibraryMovies } from "@/features/library";
import { countMovies, narrowingKey, parseMovieFilters } from "@/features/movies";
import { navItems, quickViews } from "../data/navigation";
import { useOnMoviesPage } from "../hooks/use-on-movies-page";
import { DiskUsageCard } from "./disk-usage-card";

export function AppSidebar() {
  const matchRoute = useMatchRoute();
  const { movies } = useLibraryMovies();
  const onMoviesPage = useOnMoviesPage();
  // Parsed like the Movies route does, so search params from other routes can't leak into the key.
  const currentNarrowing = useSearch({ strict: false, select: (search) => narrowingKey(parseMovieFilters(search)) });

  const views = useMemo(
    () =>
      quickViews.map((view) => ({
        ...view,
        count: countMovies(movies, view.search),
        isActive: onMoviesPage && narrowingKey(view.search) === currentNarrowing,
      })),
    [movies, onMoviesPage, currentNarrowing],
  );
  const quickViewActive = views.some((view) => view.isActive);

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" tooltip="Blockbuster" render={<Link to="/" />}>
              <img src="/logo.png" alt="" className="size-8 shrink-0" />
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
              {navItems.map((item) => {
                // A quick view below is the more specific match, so Movies steps back while one is on.
                const isActive =
                  Boolean(matchRoute({ to: item.to, fuzzy: !item.exact })) && !(item.to === "/movies" && quickViewActive);
                return (
                  <SidebarMenuItem key={item.to}>
                    <SidebarMenuButton isActive={isActive} tooltip={item.title} render={<Link to={item.to} />}>
                      <item.icon />
                      <span>{item.title}</span>
                    </SidebarMenuButton>
                    {item.to === "/movies" && movies.length > 0 && (
                      <SidebarMenuBadge className="font-mono">{movies.length}</SidebarMenuBadge>
                    )}
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Quick views</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {views.map((view) => (
                <SidebarMenuItem key={view.title}>
                  <SidebarMenuButton
                    isActive={view.isActive}
                    tooltip={`${view.title} (${view.count})`}
                    render={<Link to="/movies" search={view.search} />}
                  >
                    <view.icon />
                    <span>{view.title}</span>
                  </SidebarMenuButton>
                  {view.count > 0 && <SidebarMenuBadge className="font-mono">{view.count}</SidebarMenuBadge>}
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="group-data-[collapsible=icon]:hidden">
        <DiskUsageCard />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
