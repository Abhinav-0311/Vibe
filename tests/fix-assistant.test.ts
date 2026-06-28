import { describe, expect, it } from "vitest";
import { generateFixPlan } from "@/lib/fix-assistant/fix-plan";
import { compareScans } from "@/lib/fix-assistant/scan-comparison";
import { isValidGitHubBranch } from "@/lib/github/github-refs";
import { auditReport, type AuditFinding } from "@/lib/mock-audit";
import type { ScanApiResponse } from "@/lib/scan-api";

function createScan({
  score,
  findings,
  branch = "main",
  stage = "prototype",
}: {
  score: number;
  findings: AuditFinding[];
  branch?: string;
  stage?: "prototype" | "launch-prep" | "production";
}): ScanApiResponse {
  return {
    scannedProject: "Vibe",
    scannedAt: "2026-06-18T00:00:00.000Z",
    scanSource: {
      type: "github",
      label: "Abhinav-0311/Vibe",
      repository: { owner: "Abhinav-0311", repo: "Vibe", branch },
    },
    facts: {
      projectRoot: "/tmp/vibe",
      packageManager: "npm",
      framework: { name: "Next.js", confidence: "high" },
      scripts: { test: "vitest run", build: "next build", dangerous: "secret script body" },
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
        hasHealthRoute: false,
        hasLocalEnvFile: false,
        hasEnvGitignoreRule: false,
        hasRateLimitImplementation: false,
        hasWildcardCors: false,
        hasInsecureSessionCookie: false,
        hasLockfile: true,
        hasBuildScript: true,
        hasStartScript: true,
        hasDevelopmentStartScript: true,
        ignoresTypeScriptBuildErrors: false,
        ignoresEslintBuildErrors: false,
      },
    },
    checklist: {
      score,
      context: {
        appType: "saas",
        stage,
        hasPayments: false,
        hasUserAccounts: false,
        storesUserData: false,
      },
      findings,
      summary: { critical: 0, high: 0, medium: 0, low: 0 },
    },
    report: {
      generatedAt: "2026-06-18T00:00:00.000Z",
      readinessLabel: "Needs work",
      executiveSummary: "Summary",
      interpretation: "Interpretation",
      topRisks: [],
      nextActions: [],
      promptQueueSummary: "Queue",
    },
  };
}

describe("fix plan", () => {
  it("excludes ignored findings and orders the queue by severity", () => {
    const findings = [
      { ...auditReport.findings[3], status: "open" as const },
      { ...auditReport.findings[0], status: "ignored" as const },
      { ...auditReport.findings[2], status: "planned" as const },
      { ...auditReport.findings[1], status: "open" as const },
    ];
    const plan = generateFixPlan({ projectName: "Vibe Audit", findings });

    expect(plan.items.map((item) => item.id)).toEqual([auditReport.findings[1].id, auditReport.findings[3].id, auditReport.findings[2].id]);
    expect(plan.markdown).not.toContain(auditReport.findings[0].title);
    expect(plan.branchName).toBe("vibe/readiness-vibe-audit");
  });

  it("includes evidence, prompts, verification commands, and the re-scan gate without leaking script bodies", () => {
    const scan = createScan({ score: 50, findings: [auditReport.findings[0]] });
    const plan = generateFixPlan({ projectName: "Vibe", findings: scan.checklist.findings, facts: scan.facts });

    expect(plan.markdown).toContain(auditReport.findings[0].evidence);
    expect(plan.markdown).toContain(auditReport.findings[0].prompt);
    expect(plan.roadmap).toHaveLength(3);
    expect(plan.roadmap[0].findingIds).toEqual([auditReport.findings[0].id]);
    expect(plan.markdown).toContain("## Readiness Roadmap");
    expect(plan.markdown).toContain("### Learning note");
    expect(plan.markdown).toContain("`npm run test`");
    expect(plan.markdown).toContain("`npm run build`");
    expect(plan.markdown).toContain("Re-run Vibe");
    expect(plan.markdown).not.toContain("secret script body");
  });
});

describe("scan comparison", () => {
  it("compares the same repository across base and fix branches", () => {
    const baseline = createScan({ score: 45, findings: [auditReport.findings[0], auditReport.findings[1]], branch: "main" });
    const current = createScan({ score: 78, findings: [auditReport.findings[1], auditReport.findings[2]], branch: "vibe/readiness-vibe" });
    const comparison = compareScans(baseline, current);

    expect(comparison?.scoreDelta).toBe(33);
    expect(comparison?.resolved.map((item) => item.id)).toEqual([auditReport.findings[0].id]);
    expect(comparison?.remaining.map((item) => item.id)).toEqual([auditReport.findings[1].id]);
    expect(comparison?.introduced.map((item) => item.id)).toEqual([auditReport.findings[2].id]);
  });

  it("refuses to compare scans with different audit contexts", () => {
    const baseline = createScan({ score: 45, findings: [], stage: "prototype" });
    const current = createScan({ score: 80, findings: [], stage: "production" });
    expect(compareScans(baseline, current)).toBeNull();
  });
});

describe("GitHub branch validation", () => {
  it("accepts normal fix branches and rejects unsafe ref names", () => {
    expect(isValidGitHubBranch("vibe/readiness-auth-fixes")).toBe(true);
    expect(isValidGitHubBranch("feature..fix")).toBe(false);
    expect(isValidGitHubBranch("feature fix")).toBe(false);
    expect(isValidGitHubBranch("feature@{fix")).toBe(false);
    expect(isValidGitHubBranch("feature.lock")).toBe(false);
    expect(isValidGitHubBranch("feature.lock/next")).toBe(false);
    expect(isValidGitHubBranch("feature/.hidden")).toBe(false);
    expect(isValidGitHubBranch("/feature")).toBe(false);
  });
});
