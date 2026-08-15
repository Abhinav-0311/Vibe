import { NextResponse } from "next/server";
import { readAuditContext, readAuditProfileMode } from "@/lib/audit-context";
import { createScanResponse } from "@/lib/scan-response";
import { resolveWorkspaceProjectPath } from "@/lib/workspace-paths";
import { enforceBetaScanQuota, getBetaUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const betaUser = await getBetaUser();
  if (!betaUser) return NextResponse.json({ error: "Private beta access is required." }, { status: 401 });
  const quota = await enforceBetaScanQuota(betaUser.id);
  if (!quota.allowed) return NextResponse.json({ error: "Daily beta scan limit reached. Try again later." }, { status: 429, headers: { "Retry-After": quota.retryAfterSeconds.toString() } });
  const searchParams = new URL(request.url).searchParams;
  const resolvedProject = resolveWorkspaceProjectPath(searchParams.get("projectPath"));

  if ("error" in resolvedProject) {
    return NextResponse.json({ error: resolvedProject.error }, { status: 400 });
  }

  const context = readAuditContext(searchParams);
  const response = await createScanResponse(resolvedProject.projectPath, context, undefined, undefined, readAuditProfileMode(searchParams), betaUser.id);

  return NextResponse.json(response);
}
