import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createRouter, RouterProvider } from "@tanstack/react-router";
import { Toaster } from "@/components/ui/toast";
import { TooltipProvider } from "@/components/ui/tooltip";
import { RouteError } from "@/features/layout";
import { ThemeProvider } from "@/features/theme";
import { routeTree } from "./routeTree.gen";
import "./index.css";

// Every route gets its own error boundary, so a crashing page keeps the app shell around it.
const router = createRouter({ routeTree, defaultErrorComponent: RouteError });

// Catalog data only changes through our own mutations, which invalidate it explicitly.
const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: Infinity, refetchOnWindowFocus: false, retry: false } },
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

// App-wide providers sit above the router so error, not-found and layout-less routes get them too.
ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <TooltipProvider>
          <Toaster>
            <RouterProvider router={router} />
          </Toaster>
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  </React.StrictMode>,
);
