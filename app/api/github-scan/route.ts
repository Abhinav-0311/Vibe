import { NextResponse } from "next/server";
import { readAuditContext, readAuditProfileMode } from "@/lib/audit-context";
import { githubErrorPayload } from "@/lib/github/github-api";
import { downloadGitHubRepoZip } from "@/lib/github/github-repo";
import { getGitHubAccessToken } from "@/lib/github/github-session";
import { createScanResponse } from "@/lib/scan-response";
import { enforcePublicScanRateLimit } from "@/lib/scan-rate-limit";
import { extractProjectZipBuffer } from "@/lib/upload/zip-project";

export const dynamic = "force-dynamic";

function formatArchiveDetail(archiveName: string, branch: string, relativeProjectRoot: string) {
  const nestedRoot = relativeProjectRoot.split(/[\\/]+/).filter(Boolean).slice(1).join("/");
  return nestedRoot ? `${archiveName} / ${branch} / ${nestedRoot}` : `${archiveName} / ${branch}`;
}

export async function POST(request: Request) {
  let uploadedProject: Awaited<ReturnType<typeof extractProjectZipBuffer>> | null = null;

  try {
    const rateLimit = await enforcePublicScanRateLimit(request, "github");
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: "Too many GitHub scans. Wait a minute before trying again." },
        { status: 429, headers: { "Retry-After": rateLimit.retryAfterSeconds.toString() } },
      );
    }
    const body = (await request.json()) as {
      repoUrl?: string;
      branch?: string;
      appType?: string;
      stage?: string;
      hasPayments?: boolean;
      hasUserAccounts?: boolean;
      storesUserData?: boolean;
      profileMode?: string;
    };

    if (!body.repoUrl) {
      return NextResponse.json({ error: "Missing GitHub repository URL." }, { status: 400 });
    }

    const params = new URLSearchParams({
      appType: body.appType ?? "content-site",
      stage: body.stage ?? "prototype",
      hasPayments: String(Boolean(body.hasPayments)),
      hasUserAccounts: String(Boolean(body.hasUserAccounts)),
      storesUserData: String(Boolean(body.storesUserData)),
      profileMode: body.profileMode ?? "auto",
    });
    const token = await getGitHubAccessToken();
    const archive = await downloadGitHubRepoZip(body.repoUrl, { token, branch: body.branch });
    uploadedProject = await extractProjectZipBuffer(archive.buffer);
    const response = await createScanResponse(uploadedProject.projectRoot, readAuditContext(params), {
      type: "github",
      label: "GitHub repository",
      detail: formatArchiveDetail(archive.name, archive.branch, uploadedProject.relativeProjectRoot),
      repository: {
        ...archive.repository,
        branch: archive.branch,
      },
    }, archive.name, readAuditProfileMode(params));

    return NextResponse.json({
      ...response,
      scannedProject: archive.name,
    });
  } catch (error) {
    const payload = githubErrorPayload(error);
    return NextResponse.json(payload.body, { status: payload.status });
  } finally {
    await uploadedProject?.cleanup();
  }
}
