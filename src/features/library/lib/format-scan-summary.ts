import type { ScanSummary } from "../types";

export function formatScanSummary({ added, updated, missing }: ScanSummary) {
  const parts = [
    added > 0 && `${added} added`,
    updated > 0 && `${updated} updated`,
    missing > 0 && `${missing} no longer found`,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : "No changes";
}
