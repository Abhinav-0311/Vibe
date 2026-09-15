import { NextResponse } from "next/server";
import { readAuditContext, readAuditProfileMode } from "@/lib/audit-context";
import { createScanResponse } from "@/lib/scan-response";
import { enforcePublicScanRateLimit } from "@/lib/scan-rate-limit";
import { extractUploadedProject, UploadValidationError } from "@/lib/upload/zip-project";
import { reportServerError } from "@/lib/observability/server";
import { enforceBetaScanQuota, getBetaUser } from "@/lib/auth";
import { apiError } from "@/lib/api-error";
import { reportScanCompleted } from "@/lib/scan-telemetry";

export const dynamic = "force-dynamic";

function formatUploadDetail(fileName: string, relativeProjectRoot: string) {
  return relativeProjectRoot ? `${fileName} / ${relativeProjectRoot}` : fileName;
}

export async function POST(request: Request) {
  let uploadedProject: Awaited<ReturnType<typeof extractUploadedProject>> | null = null;
  const requestStartedAt = Date.now();

  try {
    const betaUser = await getBetaUser();
    if (!betaUser) return apiError("Private beta access is required.", "auth_required", 401);
    const quota = await enforceBetaScanQuota(betaUser.id);
    if (!quota.allowed) return apiError("Daily beta scan limit reached. Try again later.", "quota_exceeded", 429, { retryAfterSeconds: quota.retryAfterSeconds });
    const rateLimit = await enforcePublicScanRateLimit(request, "upload");
    if (!rateLimit.allowed) {
      return apiError("Too many upload scans. Wait a minute before trying again.", "rate_limited", 429, { retryAfterSeconds: rateLimit.retryAfterSeconds });
    }
    const formData = await request.formData();
    const file = formData.get("project");

    if (!(file instanceof File)) {
      return apiError("Missing project ZIP upload.", "invalid_upload", 400);
    }

    const extractionStartedAt = Date.now();
    uploadedProject = await extractUploadedProject(file);
    const extractionMs = Date.now() - extractionStartedAt;
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
    }, projectName, readAuditProfileMode(searchParams), betaUser.id, uploadedProject.repositoryRoot, { extractionMs });

    reportScanCompleted({
      source: "upload",
      totalMs: Date.now() - requestStartedAt,
      extractionMs,
      analysisMs: response.timing?.analysisMs,
      enhancementMs: response.timing?.enhancementMs,
      setupPackMs: response.timing?.setupPackMs,
      architectureStressMs: response.timing?.architectureStressMs,
      persistenceMs: response.timing?.persistenceMs,
    });

    return NextResponse.json({
      ...response,
      scannedProject: projectName,
    });
  } catch (error) {
    if (!(error instanceof UploadValidationError)) reportServerError("upload_scan_failed", { status: 500 });
    return apiError(
      error instanceof UploadValidationError ? error.message : "Vibe could not safely inspect this upload. Try a different ZIP.",
      error instanceof UploadValidationError ? "invalid_upload" : "scan_failed",
      error instanceof UploadValidationError ? 400 : 500,
    );
  } finally {
    await uploadedProject?.cleanup();
  }
}
