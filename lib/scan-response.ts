import path from "node:path";
import type { AuditContext } from "@/lib/checklist/types";
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
): Promise<ScanApiResponse> {
  const facts = await scanProject(projectPath);
  const deterministicChecklist = runChecklist(facts, context);
  const scannedAt = new Date().toISOString();
  const deterministicReport = generateReport({ facts, checklist: deterministicChecklist, scannedAt });
  const scannedProject = projectName;
  const enhanced = await enhanceReportWithOpenAI({
    projectName: scannedProject,
    facts,
    checklist: deterministicChecklist,
    report: deterministicReport,
  });
  const checklist = enhanced.checklist;
  const report = enhanced.report;
  const setupPack = generateSetupPack({ projectName: scannedProject, facts, checklist });
  const architectureStress = runArchitectureStressTest(facts, checklist);

  const response: ScanApiResponse = {
    scannedProject,
    scanSource: source,
    scannedAt,
    facts,
    checklist,
    report,
    setupPack,
    architectureStress,
  };
  const persistence = await saveScanRecord(response);

  return {
    ...response,
    persistence,
  };
}
