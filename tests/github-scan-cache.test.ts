import { describe, expect, it } from "vitest";
import { createGitHubScanCacheKey } from "@/lib/github/github-scan-cache";

const revision = {
  name: "owner/project",
  repository: { owner: "owner", repo: "project" },
  branch: "main",
  commitSha: "a1b2c3",
  isPublic: true,
};

const context = {
  appType: "saas" as const,
  stage: "launch-prep" as const,
  hasPayments: true,
  hasUserAccounts: true,
  storesUserData: true,
};

describe("GitHub scan cache keys", () => {
  it("is stable for the same immutable source and profile", () => {
    const input = { revision, projectPath: "apps/web", context, profileMode: "auto" as const };
    expect(createGitHubScanCacheKey(input)).toBe(createGitHubScanCacheKey(input));
  });

  it("changes when the commit, selected app, or profile changes", () => {
    const base = createGitHubScanCacheKey({ revision, projectPath: "apps/web", context, profileMode: "auto" });
    expect(createGitHubScanCacheKey({ revision: { ...revision, commitSha: "next-commit" }, projectPath: "apps/web", context, profileMode: "auto" })).not.toBe(base);
    expect(createGitHubScanCacheKey({ revision, projectPath: "apps/api", context, profileMode: "auto" })).not.toBe(base);
    expect(createGitHubScanCacheKey({ revision, projectPath: "apps/web", context, profileMode: "manual" })).not.toBe(base);
  });
});
