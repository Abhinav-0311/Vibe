import path from "node:path";
import type { AuditContext } from "@/lib/checklist/types";
import { runChecklist } from "@/lib/checklist/checklist-engine";
import { saveScanRecord } from "@/lib/db/scan-records";
import { generateReport } from "@/lib/report/report-generator";
import type { ScanApiResponse } from "@/lib/scan-api";
import { scanProject } from "@/lib/scanner/project-scanner";

export async function createScanResponse(projectPath: string, context: AuditContext): Promise<ScanApiResponse> {
  const facts = await scanProject(projectPath);
  const checklist = runChecklist(facts, context);
  const scannedAt = new Date().toISOString();
  const report = generateReport({ facts, checklist, scannedAt });

  const response: ScanApiResponse = {
    scannedProject: path.basename(projectPath),
    scannedAt,
    facts,
    checklist,
    report,
  };
  const persistence = await saveScanRecord(response);

  return {
    ...response,
    persistence,
  };
}
