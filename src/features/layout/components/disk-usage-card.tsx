import { HardDriveIcon } from "lucide-react";
import { Progress, ProgressLabel, ProgressValue } from "@/components/ui/progress";
import { mockDiskUsage } from "../data/mock-disk-usage";

export function DiskUsageCard() {
  const { usedGb, totalGb } = mockDiskUsage;

  return (
    <div className="flex flex-col gap-3 rounded-lg border bg-background p-3">
      <div className="flex items-center gap-2 text-sm font-medium">
        <HardDriveIcon className="text-muted-foreground" />
        Storage
      </div>
      <Progress value={(usedGb / totalGb) * 100}>
        <ProgressLabel className="text-xs text-muted-foreground">
          {usedGb} GB of {totalGb} GB used
        </ProgressLabel>
        <ProgressValue className="ml-auto text-xs" />
      </Progress>
    </div>
  );
}
