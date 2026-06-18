import { NextResponse } from "next/server";
import { readAuditContext } from "@/lib/audit-context";
import { githubErrorPayload } from "@/lib/github/github-api";
import { downloadGitHubRepoZip } from "@/lib/github/github-repo";
import { getGitHubAccessToken } from "@/lib/github/github-session";
import { createScanResponse } from "@/lib/scan-response";
import { extractProjectZipBuffer } from "@/lib/upload/zip-project";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let uploadedProject: Awaited<ReturnType<typeof extractProjectZipBuffer>> | null = null;

  try {
    const body = (await request.json()) as {
      repoUrl?: string;
      branch?: string;
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
    const token = await getGitHubAccessToken();
    const archive = await downloadGitHubRepoZip(body.repoUrl, { token, branch: body.branch });
    uploadedProject = await extractProjectZipBuffer(archive.buffer);
    const response = await createScanResponse(uploadedProject.projectRoot, readAuditContext(params), {
      type: "github",
      label: "GitHub repository",
      detail: `${archive.name} / ${archive.branch}`,
      repository: {
        ...archive.repository,
        branch: archive.branch,
      },
    }, archive.name);

    return NextResponse.json({
      ...response,
      scannedProject: archive.name,
    });
  } catch (error) {
    const payload = githubErrorPayload(error);
    const status = payload.status === 500 && error instanceof Error ? 400 : payload.status;
    return NextResponse.json(payload.body, { status });
  } finally {
    await uploadedProject?.cleanup();
  }
}
