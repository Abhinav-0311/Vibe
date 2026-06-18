import type { ScanApiResponse } from "@/lib/scan-api";
import type { ScanComparison } from "@/lib/fix-assistant/types";

function sameProject(baseline: ScanApiResponse, current: ScanApiResponse) {
  const baselineContext = baseline.checklist.context;
  const currentContext = current.checklist.context;
  const sameContext =
    baselineContext.appType === currentContext.appType &&
    baselineContext.stage === currentContext.stage &&
    baselineContext.hasPayments === currentContext.hasPayments &&
    baselineContext.hasUserAccounts === currentContext.hasUserAccounts &&
    baselineContext.storesUserData === currentContext.storesUserData;
  if (!sameContext) return false;

  const baselineRepository = baseline.scanSource?.repository;
  const currentRepository = current.scanSource?.repository;
  if (baselineRepository || currentRepository) {
    return Boolean(
      baselineRepository &&
        currentRepository &&
        baselineRepository.owner === currentRepository.owner &&
        baselineRepository.repo === currentRepository.repo,
    );
  }

  return baseline.scannedProject === current.scannedProject && baseline.facts.projectRoot === current.facts.projectRoot;
}

export function compareScans(baseline: ScanApiResponse | null, current: ScanApiResponse): ScanComparison | null {
  if (!baseline || !sameProject(baseline, current)) return null;

  const baselineIds = new Set(baseline.checklist.findings.map((finding) => finding.id));
  const currentIds = new Set(current.checklist.findings.map((finding) => finding.id));
  const baselineById = new Map(baseline.checklist.findings.map((finding) => [finding.id, finding.title]));
  const currentById = new Map(current.checklist.findings.map((finding) => [finding.id, finding.title]));

  return {
    baselineScore: baseline.checklist.score,
    currentScore: current.checklist.score,
    scoreDelta: current.checklist.score - baseline.checklist.score,
    resolved: [...baselineIds]
      .filter((id) => !currentIds.has(id))
      .sort()
      .map((id) => ({ id, title: baselineById.get(id) ?? id })),
    remaining: [...currentIds]
      .filter((id) => baselineIds.has(id))
      .sort()
      .map((id) => ({ id, title: currentById.get(id) ?? id })),
    introduced: [...currentIds]
      .filter((id) => !baselineIds.has(id))
      .sort()
      .map((id) => ({ id, title: currentById.get(id) ?? id })),
  };
}
