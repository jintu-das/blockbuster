import { createFileRoute } from "@tanstack/react-router";
import { LibrariesPage } from "@/features/library";

export const Route = createFileRoute("/libraries")({
  component: LibrariesPage,
});
