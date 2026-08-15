import { NextResponse } from "next/server";
import { readAuditContext, readAuditProfileMode } from "@/lib/audit-context";
import { createScanResponse } from "@/lib/scan-response";
import { enforcePublicScanRateLimit } from "@/lib/scan-rate-limit";
import { extractUploadedProject, UploadValidationError } from "@/lib/upload/zip-project";
import { reportServerError } from "@/lib/observability/server";
import { enforceBetaScanQuota, getBetaUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

function formatUploadDetail(fileName: string, relativeProjectRoot: string) {
  return relativeProjectRoot ? `${fileName} / ${relativeProjectRoot}` : fileName;
}

export async function POST(request: Request) {
  let uploadedProject: Awaited<ReturnType<typeof extractUploadedProject>> | null = null;

  try {
    const betaUser = await getBetaUser();
    if (!betaUser) return NextResponse.json({ error: "Private beta access is required." }, { status: 401 });
    const quota = await enforceBetaScanQuota(betaUser.id);
    if (!quota.allowed) return NextResponse.json({ error: "Daily beta scan limit reached. Try again later." }, { status: 429, headers: { "Retry-After": quota.retryAfterSeconds.toString() } });
    const rateLimit = await enforcePublicScanRateLimit(request, "upload");
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: "Too many upload scans. Wait a minute before trying again." },
        { status: 429, headers: { "Retry-After": rateLimit.retryAfterSeconds.toString() } },
      );
    }
    const formData = await request.formData();
    const file = formData.get("project");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Missing project ZIP upload." }, { status: 400 });
    }

    uploadedProject = await extractUploadedProject(file);
    const searchParams = new URLSearchParams();

    for (const [key, value] of formData.entries()) {
      if (typeof value === "string") {
        searchParams.set(key, value);
      }
    }

    const projectName = file.name.replace(/\.zip$/i, "");
    const response = await createScanResponse(uploadedProject.projectRoot, readAuditContext(searchParams), {
      type: "upload",
      label: "ZIP upload",
      detail: formatUploadDetail(file.name, uploadedProject.relativeProjectRoot),
    }, projectName, readAuditProfileMode(searchParams), betaUser.id);

    return NextResponse.json({
      ...response,
      scannedProject: projectName,
    });
  } catch (error) {
    if (!(error instanceof UploadValidationError)) reportServerError("upload_scan_failed", { status: 500 });
    return NextResponse.json(
      { error: error instanceof UploadValidationError ? error.message : "Vibe could not safely inspect this upload. Try a different ZIP." },
      { status: error instanceof UploadValidationError ? 400 : 500 },
    );
  } finally {
    await uploadedProject?.cleanup();
  }
}
