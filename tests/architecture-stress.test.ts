import { describe, expect, it } from "vitest";
import { runArchitectureStressTest } from "@/lib/architecture-stress/architecture-stress";
import type { ChecklistResult } from "@/lib/checklist/types";
import { auditReport } from "@/lib/mock-audit";
import type { ScannerFacts } from "@/lib/scanner/types";

function facts(overrides: Partial<ScannerFacts> = {}): ScannerFacts {
  return {
    projectRoot: "/project",
    packageManager: "npm",
    framework: { name: "Next.js", confidence: "high" },
    scripts: { build: "next build", test: "vitest run", start: "next start" },
    dependencies: [],
    detectedFiles: [],
    apiRoutes: [],
    signals: {
      hasPackageJson: true,
      hasNextConfig: true,
      hasAppRouter: true,
      hasPagesRouter: false,
      hasEnvExample: true,
      hasTests: true,
      hasMiddleware: false,
      hasAuthDependency: false,
      hasStripeDependency: false,
      hasAnalyticsPlan: true,
      hasAnalyticsDependency: false,
      hasObservabilityPlan: true,
      hasErrorTrackingDependency: false,
      hasAiRules: true,
      hasAuthRoute: false,
      hasCredentialAuthRoute: false,
      hasPasswordRecoveryRoute: false,
      hasSessionManagementRoute: false,
      hasPaymentRoute: false,
      hasWebhookRoute: false,
      hasWebhookSignatureVerification: false,
      hasHealthRoute: true,
      hasLocalEnvFile: false,
      hasEnvGitignoreRule: false,
      hasRateLimitImplementation: true,
      hasWildcardCors: false,
      hasInsecureSessionCookie: false,
      hasLockfile: true,
      hasBuildScript: true,
      hasStartScript: true,
      hasDevelopmentStartScript: false,
      ignoresTypeScriptBuildErrors: false,
      ignoresEslintBuildErrors: false,
    },
    ...overrides,
  };
}

function checklist(findings: ChecklistResult["findings"] = []): ChecklistResult {
  return {
    score: findings.length > 0 ? 45 : 100,
    context: {
      appType: "saas",
      stage: "launch-prep",
      hasPayments: false,
      hasUserAccounts: false,
      storesUserData: false,
    },
    findings,
    summary: { critical: 0, high: 0, medium: 0, low: 0 },
  };
}

describe("architecture stress test", () => {
  it("returns all six deterministic architecture lenses", () => {
    const result = runArchitectureStressTest(facts(), checklist());

    expect(result.assessments.map((assessment) => assessment.id)).toEqual([
      "schema",
      "security",
      "portability",
      "cost",
      "recovery",
      "stability",
    ]);
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
  });

  it("recognizes a versioned Prisma schema and migration history", () => {
    const result = runArchitectureStressTest(
      facts({
        dependencies: [
          { name: "@prisma/client", version: "7.8.0", kind: "dependency" },
          { name: "prisma", version: "7.8.0", kind: "devDependency" },
        ],
        detectedFiles: [
          { path: "prisma/schema.prisma", exists: true },
          { path: "prisma/migrations", exists: true },
        ],
      }),
      checklist(),
    );

    expect(result.assessments.find((assessment) => assessment.id === "schema")?.status).toBe("resilient");
  });

  it("marks high-priority security findings and release instability as at risk", () => {
    const result = runArchitectureStressTest(facts(), checklist([auditReport.findings[0]]));

    expect(result.assessments.find((assessment) => assessment.id === "security")?.status).toBe("at-risk");
    expect(result.assessments.find((assessment) => assessment.id === "stability")?.status).toBe("at-risk");
  });

  it("surfaces metered and hosted provider dependencies without claiming actual spend", () => {
    const result = runArchitectureStressTest(
      facts({
        dependencies: [
          { name: "openai", version: "1.0.0", kind: "dependency" },
          { name: "stripe", version: "1.0.0", kind: "dependency" },
        ],
      }),
      checklist(),
    );
    const cost = result.assessments.find((assessment) => assessment.id === "cost");

    expect(cost?.status).toBe("at-risk");
    expect(cost?.summary).toContain("cannot prove budgets");
  });
});
