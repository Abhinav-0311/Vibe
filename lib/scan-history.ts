import type { ScanApiResponse } from "@/lib/scan-api";

export type ScanHistoryItem = {
  id: string;
  scan: ScanApiResponse;
};

export const scanHistoryStorageKey = "vibe:scan-history";
const maxHistoryItems = 6;

function scanHistorySignature(scan: ScanApiResponse) {
  const repository = scan.scanSource?.repository;
  const source = repository
    ? `${scan.scanSource?.type}:${repository.owner}/${repository.repo}:${repository.branch}`
    : scan.scanSource?.type === "upload"
      ? `upload:${scan.scanSource.detail ?? scan.scannedProject}`
      : `local:${scan.facts.projectRoot}`;
  const findings = scan.checklist.findings
    .map((item) => `${item.id}:${item.severity}:${item.status}`)
    .sort();

  return JSON.stringify({
    source,
    project: scan.scannedProject,
    context: scan.checklist.context,
    score: scan.checklist.score,
    findings,
  });
}

export function createScanHistoryItem(scan: ScanApiResponse): ScanHistoryItem {
  return {
    id: scanHistorySignature(scan),
    scan,
  };
}

export function parseScanHistory(value: string | null): ScanHistoryItem[] {
  if (!value) return [];

  try {
    const parsed = JSON.parse(value) as ScanHistoryItem[];

    if (!Array.isArray(parsed)) return [];

    const validItems = parsed.filter((item) => item?.id && item?.scan?.scannedAt);

    return validItems.reduce<ScanHistoryItem[]>((history, item) => {
      const normalizedItem = createScanHistoryItem(item.scan);
      if (history.some((historyItem) => historyItem.id === normalizedItem.id)) return history;

      history.push(normalizedItem);
      return history;
    }, []).slice(0, maxHistoryItems);
  } catch {
    return [];
  }
}

export function addScanToHistory(history: ScanHistoryItem[], scan: ScanApiResponse) {
  const item = createScanHistoryItem(scan);
  const withoutDuplicate = history.filter(
    (historyItem) => createScanHistoryItem(historyItem.scan).id !== item.id,
  );

  return [item, ...withoutDuplicate].slice(0, maxHistoryItems);
}
