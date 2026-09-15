import path from "node:path";
import type { AuditProfileMode } from "@/lib/audit-context";
import type { AuditContext } from "@/lib/checklist/types";
import { inferAuditProfile, selectedAuditProfile } from "@/lib/checklist/context-inference";
import { runChecklist } from "@/lib/checklist/checklist-engine";
import { saveScanRecord } from "@/lib/db/scan-records";
import { generateReport } from "@/lib/report/report-generator";
import { enhanceReportWithOpenAI } from "@/lib/report/openai-report-enhancer";
import type { ScanApiResponse } from "@/lib/scan-api";
import { scanProject } from "@/lib/scanner/project-scanner";
import { generateSetupPack } from "@/lib/setup-pack/setup-pack-generator";
import { runArchitectureStressTest } from "@/lib/architecture-stress/architecture-stress";

export async function createScanResponse(
  projectPath: string,
  context: AuditContext,
  source: NonNullable<ScanApiResponse["scanSource"]> = {
    type: "local",
    label: "Local workspace",
    detail: projectPath,
  },
  projectName = path.basename(projectPath),
  profileMode: AuditProfileMode = "auto",
  userId?: string,
  repositoryRoot?: string,
  sourceTiming: Pick<NonNullable<ScanApiResponse["timing"]>, "sourceMs" | "extractionMs"> = {},
  sourceFingerprint?: string,
): Promise<ScanApiResponse> {
  const startedAt = Date.now();
  const analysisStartedAt = Date.now();
  const facts = await scanProject(projectPath, repositoryRoot);
  const analysisMs = Date.now() - analysisStartedAt;
  const profileInference = profileMode === "manual" ? selectedAuditProfile(context, facts) : inferAuditProfile(facts, context);
  const deterministicChecklist = runChecklist(facts, profileInference.applied);
  const scannedAt = new Date().toISOString();
  const deterministicReport = generateReport({ facts, checklist: deterministicChecklist, scannedAt });
  const scannedProject = projectName;
  const enhancementStartedAt = Date.now();
  const enhanced = await enhanceReportWithOpenAI({
    projectName: scannedProject,
    facts,
    checklist: deterministicChecklist,
    report: deterministicReport,
  });
  const enhancementMs = Date.now() - enhancementStartedAt;
  const checklist = enhanced.checklist;
  const report = enhanced.report;
  const setupPackStartedAt = Date.now();
  const setupPack = generateSetupPack({ projectName: scannedProject, facts, checklist });
  const setupPackMs = Date.now() - setupPackStartedAt;
  const architectureStressStartedAt = Date.now();
  const architectureStress = runArchitectureStressTest(facts, checklist);
  const architectureStressMs = Date.now() - architectureStressStartedAt;

  const response: ScanApiResponse = {
    scannedProject,
    scanSource: source,
    scannedAt,
    timing: {
      processingMs: Date.now() - startedAt,
      ...sourceTiming,
      analysisMs,
      enhancementMs,
      setupPackMs,
      architectureStressMs,
    },
    facts,
    profileInference,
    checklist,
    report,
    setupPack,
    architectureStress,
  };
  const persistenceStartedAt = Date.now();
  const persistence = userId
    ? await saveScanRecord(response, userId, { sourceFingerprint })
    : { attempted: false, saved: false, reason: "missing_database_url" as const };
  const persistenceMs = Date.now() - persistenceStartedAt;

  return {
    ...response,
    timing: response.timing
      ? { ...response.timing, persistenceMs }
      : { processingMs: 0, persistenceMs },
    persistence,
  };
}

/** Rehydrates a per-user cached immutable public-repository report for a new request. */
export function reuseCachedScanResponse(cached: ScanApiResponse, processingMs: number): ScanApiResponse {
  return {
    ...cached,
    scannedAt: new Date().toISOString(),
    timing: {
      processingMs,
      cacheHit: true,
    },
    persistence: undefined,
  };
}
