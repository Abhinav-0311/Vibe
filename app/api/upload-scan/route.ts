import { NextResponse } from "next/server";
import { readAuditContext, readAuditProfileMode } from "@/lib/audit-context";
import { createScanResponse } from "@/lib/scan-response";
import { enforcePublicScanRateLimit } from "@/lib/scan-rate-limit";
import { extractUploadedProject, UploadValidationError } from "@/lib/upload/zip-project";

export const dynamic = "force-dynamic";

function formatUploadDetail(fileName: string, relativeProjectRoot: string) {
  return relativeProjectRoot ? `${fileName} / ${relativeProjectRoot}` : fileName;
}

export async function POST(request: Request) {
  let uploadedProject: Awaited<ReturnType<typeof extractUploadedProject>> | null = null;

  try {
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
    }, projectName, readAuditProfileMode(searchParams));

    return NextResponse.json({
      ...response,
      scannedProject: projectName,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof UploadValidationError ? error.message : "Vibe could not safely inspect this upload. Try a different ZIP." },
      { status: error instanceof UploadValidationError ? 400 : 500 },
    );
  } finally {
    await uploadedProject?.cleanup();
  }
}
