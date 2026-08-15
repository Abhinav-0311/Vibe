import type { ScanApiResponse } from "@/lib/scan-api";
import type { ScanHistoryItem } from "@/lib/scan-history";

export type ScanComparison = {
  baseline: ScanApiResponse;
  scoreChange: number;
  resolvedFindingIds: string[];
  newFindingIds: string[];
  unchangedFindingIds: string[];
};

export function scanComparisonKey(scan: ScanApiResponse) {
  const repository = scan.scanSource?.repository;
  const source = repository
    ? `${scan.scanSource?.type}:${repository.owner}/${repository.repo}:${repository.branch}`
    : scan.scanSource?.type === "upload"
      ? `upload:${scan.scanSource.detail ?? scan.scannedProject}`
      : `local:${scan.facts.projectRoot}`;

  return JSON.stringify({ source, project: scan.scannedProject, context: scan.checklist.context });
}

export function findPreviousComparableScan(history: ScanHistoryItem[], scan: ScanApiResponse) {
  const key = scanComparisonKey(scan);
  return history.find((item) => item.scan.scannedAt !== scan.scannedAt && scanComparisonKey(item.scan) === key)?.scan ?? null;
}

export function compareScans(baseline: ScanApiResponse, current: ScanApiResponse): ScanComparison {
  const baselineFindingIds = new Set(baseline.checklist.findings.map((finding) => finding.id));
  const currentFindingIds = new Set(current.checklist.findings.map((finding) => finding.id));

  return {
    baseline,
    scoreChange: current.checklist.score - baseline.checklist.score,
    resolvedFindingIds: [...baselineFindingIds].filter((id) => !currentFindingIds.has(id)),
    newFindingIds: [...currentFindingIds].filter((id) => !baselineFindingIds.has(id)),
    unchangedFindingIds: [...currentFindingIds].filter((id) => baselineFindingIds.has(id)),
  };
}
