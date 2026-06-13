import type { ScanApiResponse } from "@/lib/scan-api";

export type ScanHistoryItem = {
  id: string;
  scan: ScanApiResponse;
};

export const scanHistoryStorageKey = "vibe:scan-history";
const maxHistoryItems = 6;

export function createScanHistoryItem(scan: ScanApiResponse): ScanHistoryItem {
  return {
    id: `${scan.scannedAt}-${scan.checklist.context.stage}-${scan.checklist.score}`,
    scan,
  };
}

export function parseScanHistory(value: string | null): ScanHistoryItem[] {
  if (!value) return [];

  try {
    const parsed = JSON.parse(value) as ScanHistoryItem[];

    if (!Array.isArray(parsed)) return [];

    return parsed.filter((item) => item?.id && item?.scan?.scannedAt);
  } catch {
    return [];
  }
}

export function addScanToHistory(history: ScanHistoryItem[], scan: ScanApiResponse) {
  const item = createScanHistoryItem(scan);
  const withoutDuplicate = history.filter((historyItem) => historyItem.id !== item.id);

  return [item, ...withoutDuplicate].slice(0, maxHistoryItems);
}
