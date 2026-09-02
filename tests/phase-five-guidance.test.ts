import { describe, expect, it } from "vitest";
import { createPullRequestBrief } from "@/lib/github/pull-request-brief";
import { getNextJsGuidance } from "@/lib/nextjs-guidance";
import type { AuditFinding } from "@/lib/mock-audit";
import type { ScannerFacts } from "@/lib/scanner/types";

const facts: ScannerFacts = {
  projectRoot: "project", packageManager: "npm", framework: { name: "Next.js", confidence: "high" }, scripts: {}, dependencies: [], detectedFiles: [], apiRoutes: [{ route: "/api/scan", file: "route.ts", signals: [] }],
  signals: { hasPackageJson: true, hasNextConfig: true, hasAppRouter: true, hasPagesRouter: false, hasEnvExample: false, hasTests: true, hasMiddleware: false, hasAuthDependency: true, hasStripeDependency: false, hasAnalyticsPlan: false, hasAnalyticsDependency: false, hasObservabilityPlan: false, hasErrorTrackingDependency: false, hasAiRules: true, hasAuthRoute: true, hasCredentialAuthRoute: false, hasPasswordRecoveryRoute: false, hasSessionManagementRoute: true, hasPaymentRoute: false, hasWebhookRoute: false, hasWebhookSignatureVerification: false, hasHealthRoute: true, hasLocalEnvFile: false, hasEnvGitignoreRule: true, hasRateLimitImplementation: true, hasWildcardCors: false, hasInsecureSessionCookie: false, hasLockfile: true, hasBuildScript: true, hasStartScript: true, hasDevelopmentStartScript: false, ignoresTypeScriptBuildErrors: false, ignoresEslintBuildErrors: false },
};

const finding: AuditFinding = { id: "env", title: "Missing environment docs", category: "Security", severity: "high", status: "open", evidence: "No .env.example", severityReason: "Secrets", impact: "Deployments can fail.", fix: "Add .env.example.", verification: ["Run build"], prompt: "Create environment docs.", actionPriority: "required" };

describe("trusted guidance", () => {
  it("gives only versioned, evidence-backed Next.js guidance with verification routes", () => {
    const guidance = getNextJsGuidance(facts);
    expect(guidance.map((item) => item.id)).toEqual(["nextjs-route-recovery", "nextjs-route-handler-boundaries", "nextjs-environment-boundaries"]);
    expect(guidance.every((item) => item.catalogVersion === "2026.08" && item.source.url.startsWith("https://nextjs.org/") && item.verification.length > 20)).toBe(true);
  });

  it("creates a reviewable PR handoff without changing a repository", () => {
    const brief = createPullRequestBrief("owner/repo", finding);
    expect(brief).toContain("Generated for owner/repo");
    expect(brief).toContain("does not modify the repository");
  });
});
