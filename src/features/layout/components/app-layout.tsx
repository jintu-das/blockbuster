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
      <SidebarInset>
        <AppHeader />
        <div className="flex flex-1 flex-col p-6">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
