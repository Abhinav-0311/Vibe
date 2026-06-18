import path from "node:path";
import type { AuditContext } from "@/lib/checklist/types";
import { runChecklist } from "@/lib/checklist/checklist-engine";
import { saveScanRecord } from "@/lib/db/scan-records";
import { generateReport } from "@/lib/report/report-generator";
import type { ScanApiResponse } from "@/lib/scan-api";
import { scanProject } from "@/lib/scanner/project-scanner";
import { generateSetupPack } from "@/lib/setup-pack/setup-pack-generator";

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
  const checklist = runChecklist(facts, context);
  const scannedAt = new Date().toISOString();
  const report = generateReport({ facts, checklist, scannedAt });
  const scannedProject = projectName;
  const setupPack = generateSetupPack({ projectName: scannedProject, facts, checklist });

  const response: ScanApiResponse = {
    scannedProject,
    scanSource: source,
    scannedAt,
    facts,
    checklist,
    report,
    setupPack,
  };
  const persistence = await saveScanRecord(response);

  return {
    ...response,
    persistence,
  };
}
