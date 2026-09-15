import { createHash } from "node:crypto";
import type { AuditProfileMode } from "@/lib/audit-context";
import type { AuditContext } from "@/lib/checklist/types";
import type { GitHubRepoRevision } from "@/lib/github/github-repo";

const cacheFormatVersion = 1;

/**
 * Identifies one immutable public GitHub source plus the scoring choices that
 * affect its report. The deployment SHA prevents a newer scanner from serving
 * a result produced by an older rule set.
 */
export function createGitHubScanCacheKey({
  revision,
  projectPath,
  context,
  profileMode,
}: {
  revision: GitHubRepoRevision;
  projectPath?: string;
  context: AuditContext;
  profileMode: AuditProfileMode;
}) {
  const fingerprint = JSON.stringify({
    cacheFormatVersion,
    scannerVersion: process.env.VERCEL_GIT_COMMIT_SHA ?? "local",
    repository: `${revision.repository.owner}/${revision.repository.repo}`.toLowerCase(),
    branch: revision.branch,
    commitSha: revision.commitSha,
    projectPath: projectPath?.trim().replaceAll("\\", "/") ?? "",
    context,
    profileMode,
  });

  return createHash("sha256").update(fingerprint).digest("hex");
}
