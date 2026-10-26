import { FolderOpenIcon } from "lucide-react";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";

export function LibraryEmptyState() {
  return (
    <Empty className="flex-1 border">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <FolderOpenIcon />
        </EmptyMedia>
        <EmptyTitle>No library folder yet</EmptyTitle>
        <EmptyDescription>Choose a folder of videos to build your catalog.</EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}
