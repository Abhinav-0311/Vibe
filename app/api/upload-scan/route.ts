import { NextResponse } from "next/server";
import { readAuditContext } from "@/lib/audit-context";
import { createScanResponse } from "@/lib/scan-response";
import { extractUploadedProject } from "@/lib/upload/zip-project";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let uploadedProject: Awaited<ReturnType<typeof extractUploadedProject>> | null = null;

  try {
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
      detail: file.name,
    });

    return NextResponse.json({
      ...response,
      scannedProject: projectName,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Upload scan failed.",
      },
      { status: 400 },
    );
  } finally {
    await uploadedProject?.cleanup();
  }
}
