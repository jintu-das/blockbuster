import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { useCatalogSync, useStartupScan } from "@/features/library";
import { AppHeader } from "./app-header";
import { AppSidebar } from "./app-sidebar";

export function AppLayout({ children }: { children: React.ReactNode }) {
  useCatalogSync();
  useStartupScan();

  return (
    <SidebarProvider>
      <AppSidebar />
      {/* min-w-0 lets the inset shrink beside the sidebar; without it, wide content such as the
          Home shelves' scroll rows holds it at full window width and pushes the page sideways. */}
      <SidebarInset className="min-w-0">
        <AppHeader />
        <div className="flex flex-1 flex-col p-6">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
