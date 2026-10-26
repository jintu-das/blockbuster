import { createFileRoute } from "@tanstack/react-router";
import { FolderOpenIcon } from "lucide-react";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";

export const Route = createFileRoute("/libraries")({
  component: LibrariesPage,
});

function LibrariesPage() {
  return (
    <div className="flex flex-1 flex-col gap-6">
      <h1 className="font-heading text-2xl font-semibold">Libraries</h1>
      <Empty className="flex-1 border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <FolderOpenIcon />
          </EmptyMedia>
          <EmptyTitle>No library folder yet</EmptyTitle>
          <EmptyDescription>Choose a folder of videos to build your catalog.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    </div>
  );
}
