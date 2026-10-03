import type { ScanApiResponse } from "@/lib/scan-api";

export type ScanHistoryItem = {
  id: string;
  scan: ScanApiResponse;
};

export const scanHistoryStorageKey = "vibe:scan-history";
export const findingStatusStorageKey = "vibe:finding-status-overrides";
export const findingStatusReasonStorageKey = "vibe:finding-status-reasons";
const maxHistoryItems = 6;

function encodedUserId(userId: string) {
  return encodeURIComponent(userId);
}

/**
 * Browser state is convenience data, not a source of truth. Keep it separate
 * for each authenticated account so one person's local triage cannot appear
 * in another person's session on the same browser.
 */
export function storageKeyForUser(userId: string, resource: "scan-history" | "finding-status-overrides" | "finding-status-reasons") {
  return `vibe:${encodedUserId(userId)}:${resource}`;
}

export function clearBrowserAccountData(storage: Pick<Storage, "removeItem">, userId: string) {
  const resources = ["scan-history", "finding-status-overrides", "finding-status-reasons"] as const;
  let failed = false;
  for (const resource of resources) {
    // Try every key even if browser storage rejects one removal.
    for (const key of [storageKeyForUser(userId, resource), `vibe:${resource}`]) {
      try { storage.removeItem(key); } catch { failed = true; }
    }
  }
  if (failed) throw new Error("Browser data could not be fully cleared.");
}

export function findingOverrideKey(scanScope: string, findingId: string) {
  return `${scanScope}:${findingId}`;
}

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
    appPath: scan.facts.workspace?.appPath.replace(/\\/g, "/"),
    rulesetVersion: scan.checklist.rulesetVersion ?? "legacy",
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
