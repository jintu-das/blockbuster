import { createRootRoute, Link, Outlet } from "@tanstack/react-router";
import { buttonVariants } from "@/components/ui/button";

export const Route = createRootRoute({
  component: RootLayout,
});

function RootLayout() {
  return (
    <div className="flex min-h-svh flex-col bg-background text-foreground">
      <header className="flex items-center gap-6 border-b px-6 py-3">
        <span className="font-heading text-lg font-semibold">Blockbuster</span>
        <nav className="flex items-center gap-1">
          <Link
            to="/"
            className={buttonVariants({ variant: "ghost" })}
            activeProps={{ className: buttonVariants({ variant: "secondary" }) }}
            activeOptions={{ exact: true }}
          >
            Home
          </Link>
          <Link
            to="/libraries"
            className={buttonVariants({ variant: "ghost" })}
            activeProps={{ className: buttonVariants({ variant: "secondary" }) }}
          >
            Libraries
          </Link>
        </nav>
      </header>
      <main className="flex flex-1 flex-col p-6">
        <Outlet />
      </main>
    </div>
  );
}
