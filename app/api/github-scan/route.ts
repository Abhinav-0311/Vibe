import { NextResponse } from "next/server";
import { readAuditContext, readAuditProfileMode } from "@/lib/audit-context";
import { githubErrorPayload } from "@/lib/github/github-api";
import { downloadGitHubRepoZip, resolveGitHubRepoRevision } from "@/lib/github/github-repo";
import { getGitHubAccessToken } from "@/lib/github/github-session";
import { createScanResponse, reuseCachedScanResponse } from "@/lib/scan-response";
import { enforcePublicScanRateLimit } from "@/lib/scan-rate-limit";
import { extractProjectZipBuffer, selectProjectRoot } from "@/lib/upload/zip-project";
import { reportServerError } from "@/lib/observability/server";
import { enforceBetaScanQuota, getBetaUser } from "@/lib/auth";
import { apiError } from "@/lib/api-error";
import { createGitHubScanCacheKey } from "@/lib/github/github-scan-cache";
import { findCachedGitHubScan, saveScanRecord } from "@/lib/db/scan-records";
import { reportScanCompleted } from "@/lib/scan-telemetry";

export const dynamic = "force-dynamic";

function formatArchiveDetail(archiveName: string, branch: string, relativeProjectRoot: string) {
  const nestedRoot = relativeProjectRoot.split(/[\\/]+/).filter(Boolean).slice(1).join("/");
  return nestedRoot ? `${archiveName} / ${branch} / ${nestedRoot}` : `${archiveName} / ${branch}`;
}

export async function POST(request: Request) {
  let uploadedProject: Awaited<ReturnType<typeof extractProjectZipBuffer>> | null = null;
  const requestStartedAt = Date.now();

  try {
    const betaUser = await getBetaUser();
    if (!betaUser) return apiError("Private beta access is required.", "auth_required", 401);
    const quota = await enforceBetaScanQuota(betaUser.id);
    if (!quota.allowed) return apiError("Daily beta scan limit reached. Try again later.", "quota_exceeded", 429, { retryAfterSeconds: quota.retryAfterSeconds });
    const rateLimit = await enforcePublicScanRateLimit(request, "github");
    if (!rateLimit.allowed) {
      return apiError("Too many GitHub scans. Wait a minute before trying again.", "rate_limited", 429, { retryAfterSeconds: rateLimit.retryAfterSeconds });
    }
    const body = (await request.json()) as {
      repoUrl?: string;
      branch?: string;
      projectPath?: string;
      appType?: string;
      stage?: string;
      hasPayments?: boolean;
      hasUserAccounts?: boolean;
      storesUserData?: boolean;
      profileMode?: string;
    };

    if (!body.repoUrl) {
      return apiError("Missing GitHub repository URL.", "invalid_request", 400);
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
    const sourceStartedAt = Date.now();
    const revision = await resolveGitHubRepoRevision(body.repoUrl, { token, branch: body.branch });
    const sourceFingerprint = createGitHubScanCacheKey({
      revision,
      projectPath: body.projectPath,
      context: readAuditContext(params),
      profileMode: readAuditProfileMode(params),
    });
    const cached = revision.isPublic ? await findCachedGitHubScan(betaUser.id, sourceFingerprint) : null;

    if (cached) {
      const response = reuseCachedScanResponse(cached, Date.now() - requestStartedAt);
      const persistenceStartedAt = Date.now();
      const persistence = await saveScanRecord(response, betaUser.id, { sourceFingerprint });
      const persistenceMs = Date.now() - persistenceStartedAt;
      const persisted = { ...response, timing: { ...response.timing, persistenceMs }, persistence };
      reportScanCompleted({ source: "github", totalMs: Date.now() - requestStartedAt, sourceMs: Date.now() - sourceStartedAt, persistenceMs, cacheHit: true });
      return NextResponse.json({ ...persisted, scannedProject: revision.name });
    }

    const archive = await downloadGitHubRepoZip(body.repoUrl, { token, branch: body.branch, revision });
    const sourceMs = Date.now() - sourceStartedAt;
    const extractionStartedAt = Date.now();
    uploadedProject = await extractProjectZipBuffer(archive.buffer);
    uploadedProject = await selectProjectRoot(uploadedProject, body.projectPath);
    const extractionMs = Date.now() - extractionStartedAt;
    const response = await createScanResponse(uploadedProject.projectRoot, readAuditContext(params), {
      type: "github",
      label: "GitHub repository",
      detail: formatArchiveDetail(archive.name, archive.branch, uploadedProject.relativeProjectRoot),
      repository: {
        ...archive.repository,
        branch: archive.branch,
      },
    }, archive.name, readAuditProfileMode(params), betaUser.id, uploadedProject.repositoryRoot, { sourceMs, extractionMs }, sourceFingerprint);

    reportScanCompleted({
      source: "github",
      totalMs: Date.now() - requestStartedAt,
      sourceMs,
      extractionMs,
      analysisMs: response.timing?.analysisMs,
      enhancementMs: response.timing?.enhancementMs,
      setupPackMs: response.timing?.setupPackMs,
      architectureStressMs: response.timing?.architectureStressMs,
      persistenceMs: response.timing?.persistenceMs,
    });

    return NextResponse.json({
      ...response,
      scannedProject: archive.name,
    });
  } catch (error) {
    const payload = githubErrorPayload(error);
    if (payload.status >= 500) reportServerError("github_scan_failed", { status: payload.status });
    return NextResponse.json(payload.body, { status: payload.status });
  } finally {
    await uploadedProject?.cleanup();
  }
}
