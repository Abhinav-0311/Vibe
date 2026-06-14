import { NextResponse } from "next/server";
import { readAuditContext } from "@/lib/audit-context";
import { downloadGitHubRepoZip } from "@/lib/github/github-repo";
import { createScanResponse } from "@/lib/scan-response";
import { extractProjectZipBuffer } from "@/lib/upload/zip-project";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let uploadedProject: Awaited<ReturnType<typeof extractProjectZipBuffer>> | null = null;

  try {
    const body = (await request.json()) as {
      repoUrl?: string;
      appType?: string;
      stage?: string;
      hasPayments?: boolean;
      hasUserAccounts?: boolean;
      storesUserData?: boolean;
    };

    if (!body.repoUrl) {
      return NextResponse.json({ error: "Missing GitHub repository URL." }, { status: 400 });
    }

    const params = new URLSearchParams({
      appType: body.appType ?? "saas",
      stage: body.stage ?? "prototype",
      hasPayments: String(Boolean(body.hasPayments)),
      hasUserAccounts: String(Boolean(body.hasUserAccounts)),
      storesUserData: String(Boolean(body.storesUserData)),
    });
    const archive = await downloadGitHubRepoZip(body.repoUrl);
    uploadedProject = await extractProjectZipBuffer(archive.buffer);
    const response = await createScanResponse(uploadedProject.projectRoot, readAuditContext(params));

    return NextResponse.json({
      ...response,
      scannedProject: archive.name,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "GitHub scan failed.",
      },
      { status: 400 },
    );
  } finally {
    await uploadedProject?.cleanup();
  }
}
