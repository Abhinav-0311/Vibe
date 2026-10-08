import { promises as fs } from "node:fs";
import AdmZip from "adm-zip";
import { GitHubApiError } from "@/lib/github/github-api";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getBetaUser: vi.fn(),
  enforceBetaScanQuota: vi.fn(),
  enforcePublicScanRateLimit: vi.fn(),
  resolveGitHubRepoRevision: vi.fn(),
  downloadGitHubRepoZip: vi.fn(),
  createScanResponse: vi.fn(),
  reportServerError: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ getBetaUser: mocks.getBetaUser, enforceBetaScanQuota: mocks.enforceBetaScanQuota }));
vi.mock("@/lib/scan-rate-limit", () => ({ enforcePublicScanRateLimit: mocks.enforcePublicScanRateLimit }));
vi.mock("@/lib/github/github-session", () => ({ getGitHubAccessToken: vi.fn() }));
vi.mock("@/lib/github/github-repo", () => ({ resolveGitHubRepoRevision: mocks.resolveGitHubRepoRevision, downloadGitHubRepoZip: mocks.downloadGitHubRepoZip }));
vi.mock("@/lib/scan-response", () => ({ createScanResponse: mocks.createScanResponse, reuseCachedScanResponse: vi.fn() }));
vi.mock("@/lib/db/scan-records", () => ({ findCachedGitHubScan: vi.fn(), saveScanRecord: vi.fn() }));
vi.mock("@/lib/observability/server", () => ({ reportServerError: mocks.reportServerError }));
vi.mock("@/lib/scan-telemetry", () => ({ reportScanCompleted: vi.fn() }));
vi.mock("@/lib/workspace-paths", () => ({ resolveWorkspaceProjectPath: vi.fn() }));

import { POST as uploadScan } from "@/app/api/upload-scan/route";
import { POST as githubScan } from "@/app/api/github-scan/route";
import { GET as localScan } from "@/app/api/scan/route";
import { resolveWorkspaceProjectPath } from "@/lib/workspace-paths";

beforeEach(() => {
  vi.resetAllMocks();
  mocks.getBetaUser.mockResolvedValue({ id: "test-user" });
  mocks.enforceBetaScanQuota.mockResolvedValue({ allowed: true });
  mocks.enforcePublicScanRateLimit.mockResolvedValue({ allowed: true });
  mocks.resolveGitHubRepoRevision.mockResolvedValue({
    name: "sample", branch: "main", commitSha: "test-revision", isPublic: false,
    repository: { owner: "tester", repo: "sample" },
  });
  mocks.downloadGitHubRepoZip.mockResolvedValue({ buffer: Buffer.from("not a ZIP") });
});

async function scan(source: "upload" | "github" | "local", archive?: Buffer) {
  if (source === "local") return localScan(new Request("http://localhost/api/scan"));
  if (source === "github") {
    return githubScan(new Request("http://localhost/api/github-scan", {
      method: "POST", body: JSON.stringify({ repoUrl: "https://github.com/tester/sample" }),
      headers: { "Content-Type": "application/json" },
    }));
  }
  const form = new FormData();
  form.set("project", new File([archive ? new Uint8Array(archive) : "not a ZIP"], "sample.zip"));
  return uploadScan(new Request("http://localhost/api/upload-scan", { method: "POST", body: form }));
}

describe("scan archive errors", () => {
  it.each(["upload", "github", "local"] as const)("stops the %s scan before any source work when quota is exhausted", async (source) => {
    mocks.enforceBetaScanQuota.mockResolvedValue({ allowed: false, retryAfterSeconds: 120 });
    const response = await scan(source);
    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("120");
    expect((await response.json()).code).toBe("quota_exceeded");
    expect(mocks.enforcePublicScanRateLimit).not.toHaveBeenCalled();
    expect(mocks.downloadGitHubRepoZip).not.toHaveBeenCalled();
    expect(mocks.createScanResponse).not.toHaveBeenCalled();
    expect(resolveWorkspaceProjectPath).not.toHaveBeenCalled();
    expect(mocks.reportServerError).not.toHaveBeenCalled();
  });

  it.each(["upload", "github", "local"] as const)("reports quota-store outages on the %s route as retryable service errors", async (source) => {
    mocks.enforceBetaScanQuota.mockResolvedValue({ allowed: false, retryAfterSeconds: 60, remaining: 0, unavailable: true });
    const response = await scan(source);
    expect(response.status).toBe(503);
    expect(response.headers.get("Retry-After")).toBe("60");
    expect(await response.json()).toEqual({ code: "service_unavailable", error: "Scanning is temporarily unavailable. Try again shortly." });
    expect(mocks.enforcePublicScanRateLimit).not.toHaveBeenCalled();
    expect(mocks.resolveGitHubRepoRevision).not.toHaveBeenCalled();
    expect(mocks.downloadGitHubRepoZip).not.toHaveBeenCalled();
    expect(resolveWorkspaceProjectPath).not.toHaveBeenCalled();
    expect(mocks.createScanResponse).not.toHaveBeenCalled();
  });

  it("preserves GitHub's reset time without downloading an archive or logging a server failure", async () => {
    mocks.resolveGitHubRepoRevision.mockRejectedValue(new GitHubApiError("GitHub rate limit reached.", 429, "rate_limited", "2026-10-08T15:00:00.000Z"));
    const response = await scan("github");
    expect(response.status).toBe(429);
    expect(await response.json()).toMatchObject({ code: "rate_limited", retryAt: "2026-10-08T15:00:00.000Z" });
    expect(mocks.downloadGitHubRepoZip).not.toHaveBeenCalled();
    expect(mocks.reportServerError).not.toHaveBeenCalled();
  });

  it.each(["upload", "github"] as const)("cleans up the %s archive when scan processing fails", async (source) => {
    const zip = new AdmZip();
    zip.addFile("package.json", Buffer.from('{"name":"sample"}'));
    const archive = zip.toBuffer();
    mocks.downloadGitHubRepoZip.mockResolvedValue({ buffer: archive });
    mocks.createScanResponse.mockRejectedValue(new Error("private scanner detail"));
    const remove = vi.spyOn(fs, "rm");
    try {
      const response = await scan(source, archive);
      expect(response.status).toBe(500);
      expect(JSON.stringify(await response.json())).not.toContain("private scanner detail");
      const extractedPath = String(mocks.createScanResponse.mock.calls[0][0]);
      await expect(fs.access(extractedPath)).rejects.toMatchObject({ code: "ENOENT" });
      expect(remove).toHaveBeenCalledOnce();
    } finally {
      remove.mockRestore();
    }
  });

  it.each(["upload", "github"] as const)("returns safe validation feedback for a corrupt %s archive", async (source) => {
    const response = await scan(source);
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      code: "invalid_upload",
      error: "Archive is corrupt or uses an unsupported ZIP format. Try a different ZIP.",
    });
    expect(mocks.createScanResponse).not.toHaveBeenCalled();
    expect(mocks.reportServerError).not.toHaveBeenCalled();
  });

  it.each(["upload", "github"] as const)("keeps storage failures on the %s route as private server errors", async (source) => {
    const mkdir = vi.spyOn(fs, "mkdir").mockRejectedValueOnce(Object.assign(new Error("private storage detail"), { code: "ENOSPC" }));
    try {
      const response = await scan(source);
      expect(response.status).toBe(500);
      expect(JSON.stringify(await response.json())).not.toContain("private storage detail");
      expect(mocks.createScanResponse).not.toHaveBeenCalled();
      expect(mocks.reportServerError).toHaveBeenCalled();
    } finally {
      mkdir.mockRestore();
    }
  });
});
