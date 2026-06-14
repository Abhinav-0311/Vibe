import { NextResponse } from "next/server";
import { readAuditContext } from "@/lib/audit-context";
import { createScanResponse } from "@/lib/scan-response";
import { resolveWorkspaceProjectPath } from "@/lib/workspace-paths";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const searchParams = new URL(request.url).searchParams;
  const resolvedProject = resolveWorkspaceProjectPath(searchParams.get("projectPath"));

  if ("error" in resolvedProject) {
    return NextResponse.json({ error: resolvedProject.error }, { status: 400 });
  }

  const context = readAuditContext(searchParams);
  const response = await createScanResponse(resolvedProject.projectPath, context);

  return NextResponse.json(response);
}
