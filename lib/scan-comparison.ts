import type { ScanApiResponse } from "@/lib/scan-api";
import type { ScanHistoryItem } from "@/lib/scan-history";

export type ScanComparison = {
  baseline: ScanApiResponse;
  isComparable: boolean;
  reason?: string;
  scoreChange: number;
  resolvedFindingIds: string[];
  newFindingIds: string[];
  unchangedFindingIds: string[];
};

function normalizedRepositoryPart(value: string) {
  return value.trim().toLowerCase();
}

function normalizedProjectSource(scan: ScanApiResponse) {
  const repository = scan.scanSource?.repository;
  if (repository) {
    // GitHub owner/repository names are case-insensitive; Git refs are not.
    return `github:${normalizedRepositoryPart(repository.owner)}/${normalizedRepositoryPart(repository.repo)}:${repository.branch.trim()}`;
  }

  if (scan.scanSource?.type === "upload") {
    return `upload:${(scan.scanSource.detail ?? scan.scannedProject).trim()}`;
  }

  return `local:${scan.facts.projectRoot}`;
}

export function scanComparisonKey(scan: ScanApiResponse) {
  return JSON.stringify({
    source: normalizedProjectSource(scan),
    project: scan.scannedProject,
    context: scan.checklist.context,
  });
}

export function findPreviousComparableScan(history: ScanHistoryItem[], scan: ScanApiResponse) {
  const key = scanComparisonKey(scan);
  return history.find((item) => item.scan.scannedAt !== scan.scannedAt && scanComparisonKey(item.scan) === key)?.scan ?? null;
}

export function compareScans(baseline: ScanApiResponse, current: ScanApiResponse): ScanComparison {
  const baselineRulesetVersion = baseline.checklist.rulesetVersion;
  const currentRulesetVersion = current.checklist.rulesetVersion;
  if (!baselineRulesetVersion || !currentRulesetVersion || baselineRulesetVersion !== currentRulesetVersion) {
    return {
      baseline,
      isComparable: false,
      reason: "Vibe’s readiness rules changed between these scans, so score and finding changes are not treated as project fixes.",
      scoreChange: 0,
      resolvedFindingIds: [],
      newFindingIds: [],
      unchangedFindingIds: [],
    };
  }
  const baselineFindingIds = new Set(baseline.checklist.findings.map((finding) => finding.id));
  const currentFindingIds = new Set(current.checklist.findings.map((finding) => finding.id));

  return {
    baseline,
    isComparable: true,
    scoreChange: current.checklist.score - baseline.checklist.score,
    resolvedFindingIds: [...baselineFindingIds].filter((id) => !currentFindingIds.has(id)),
    newFindingIds: [...currentFindingIds].filter((id) => !baselineFindingIds.has(id)),
    unchangedFindingIds: [...currentFindingIds].filter((id) => baselineFindingIds.has(id)),
  };
}
