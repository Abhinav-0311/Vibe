import path from "node:path";
import { NextResponse } from "next/server";
import { runChecklist } from "@/lib/checklist/checklist-engine";
import type { AuditContext } from "@/lib/checklist/types";
import { saveScanRecord } from "@/lib/db/scan-records";
import { generateReport } from "@/lib/report/report-generator";
import type { ScanApiResponse } from "@/lib/scan-api";
import { scanProject } from "@/lib/scanner/project-scanner";
import { resolveWorkspaceProjectPath } from "@/lib/workspace-paths";

export const dynamic = "force-dynamic";

function readBoolean(value: string | null) {
  return value === "true";
}

function readAuditContext(searchParams: URLSearchParams): AuditContext {
  const appType = searchParams.get("appType");
  const stage = searchParams.get("stage");

  return {
    appType:
      appType === "marketplace" ||
      appType === "internal-tool" ||
      appType === "content-site" ||
      appType === "api" ||
      appType === "unknown"
        ? appType
        : "saas",
    stage: stage === "launch-prep" || stage === "production" ? stage : "prototype",
    hasPayments: readBoolean(searchParams.get("hasPayments")),
    hasUserAccounts: readBoolean(searchParams.get("hasUserAccounts")),
    storesUserData: readBoolean(searchParams.get("storesUserData")),
  };
}

export async function GET(request: Request) {
  const searchParams = new URL(request.url).searchParams;
  const resolvedProject = resolveWorkspaceProjectPath(searchParams.get("projectPath"));

  if ("error" in resolvedProject) {
    return NextResponse.json({ error: resolvedProject.error }, { status: 400 });
  }

  const facts = await scanProject(resolvedProject.projectPath);
  const context = readAuditContext(searchParams);
  const checklist = runChecklist(facts, context);
  const scannedAt = new Date().toISOString();
  const report = generateReport({ facts, checklist, scannedAt });

  const response: ScanApiResponse = {
    scannedProject: path.basename(resolvedProject.projectPath),
    scannedAt,
    facts,
    checklist,
    report,
  };
  const persistence = await saveScanRecord(response);

  return NextResponse.json({
    ...response,
    persistence,
  });
}
