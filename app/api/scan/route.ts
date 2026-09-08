import { NextResponse } from "next/server";
import { readAuditContext, readAuditProfileMode } from "@/lib/audit-context";
import { createScanResponse } from "@/lib/scan-response";
import { resolveWorkspaceProjectPath } from "@/lib/workspace-paths";
import { enforceBetaScanQuota, getBetaUser } from "@/lib/auth";
import { apiError } from "@/lib/api-error";
import { reportServerError } from "@/lib/observability/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const betaUser = await getBetaUser();
    if (!betaUser) return apiError("Private beta access is required.", "auth_required", 401);
    const quota = await enforceBetaScanQuota(betaUser.id);
    if (!quota.allowed) return apiError("Daily beta scan limit reached. Try again later.", "quota_exceeded", 429, { retryAfterSeconds: quota.retryAfterSeconds });
    const searchParams = new URL(request.url).searchParams;
    const resolvedProject = resolveWorkspaceProjectPath(searchParams.get("projectPath"));

    if ("error" in resolvedProject) {
      return apiError(resolvedProject.error, "invalid_request", 400);
    }

    const context = readAuditContext(searchParams);
    const response = await createScanResponse(resolvedProject.projectPath, context, undefined, undefined, readAuditProfileMode(searchParams), betaUser.id);

    return NextResponse.json(response);
  } catch {
    reportServerError("local_scan_failed");
    return apiError("Vibe could not complete this local scan. Check the project path and try again.", "scan_failed", 500);
  }
}
