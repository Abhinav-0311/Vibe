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

export type ReScanVerificationGuide = {
  comparison: ScanComparison;
  evidenceCleared: ScanApiResponse["checklist"]["findings"];
  stillOpen: ScanApiResponse["checklist"]["findings"];
  newRisks: ScanApiResponse["checklist"]["findings"];
  nextVerificationSteps: string[];
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

/**
 * Turns a comparable before/after scan into a review guide. A finding is only
 * evidence-cleared: Vibe has observed that the same static ruleset no longer
 * detects its source signal. Runtime or provider-side verification is still
 * owned by the project team.
 */
export function buildReScanVerificationGuide(baseline: ScanApiResponse, current: ScanApiResponse): ReScanVerificationGuide {
  const comparison = compareScans(baseline, current);
  if (!comparison.isComparable) {
    return { comparison, evidenceCleared: [], stillOpen: [], newRisks: [], nextVerificationSteps: [] };
  }

  const baselineFindings = new Map(baseline.checklist.findings.map((finding) => [finding.id, finding]));
  const currentFindings = new Map(current.checklist.findings.map((finding) => [finding.id, finding]));
  const currentFinding = (id: string) => currentFindings.get(id);
  const baselineFinding = (id: string) => baselineFindings.get(id);
  const isFinding = (finding: ScanApiResponse["checklist"]["findings"][number] | undefined): finding is ScanApiResponse["checklist"]["findings"][number] => Boolean(finding);
  const stillOpen = comparison.unchangedFindingIds.map(currentFinding).filter(isFinding);
  const newRisks = comparison.newFindingIds.map(currentFinding).filter(isFinding);

  return {
    comparison,
    evidenceCleared: comparison.resolvedFindingIds.map(baselineFinding).filter(isFinding),
    stillOpen,
    newRisks,
    nextVerificationSteps: [...stillOpen, ...newRisks]
      .flatMap((finding) => finding.verification ?? [])
      .filter((step, index, steps) => step.trim().length > 0 && steps.indexOf(step) === index)
      .slice(0, 4),
  };
}
