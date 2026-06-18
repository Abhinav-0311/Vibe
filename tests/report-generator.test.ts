import { describe, expect, it } from "vitest";
import { runChecklist } from "@/lib/checklist/checklist-engine";
import type { AuditContext } from "@/lib/checklist/types";
import { formatMarkdownReport } from "@/lib/report/markdown-export";
import { generateReport } from "@/lib/report/report-generator";
import type { ScannerFacts } from "@/lib/scanner/types";

const facts: ScannerFacts = {
  projectRoot: "E:\\College\\Project\\Vibe",
  packageManager: "npm",
  framework: {
    name: "Next.js",
    confidence: "high",
  },
  scripts: {
    dev: "next dev",
    build: "next build",
  },
  dependencies: [],
  detectedFiles: [],
  apiRoutes: [],
  signals: {
    hasPackageJson: true,
    hasNextConfig: true,
    hasAppRouter: true,
    hasPagesRouter: false,
    hasEnvExample: false,
    hasTests: false,
    hasMiddleware: false,
    hasAuthDependency: false,
    hasStripeDependency: false,
    hasAnalyticsPlan: false,
    hasAnalyticsDependency: false,
    hasObservabilityPlan: false,
    hasErrorTrackingDependency: false,
    hasAiRules: false,
    hasAuthRoute: false,
    hasPaymentRoute: false,
    hasWebhookRoute: false,
    hasWebhookSignatureVerification: false,
    hasHealthRoute: false,
    hasLocalEnvFile: false,
    hasEnvGitignoreRule: false,
    hasRateLimitImplementation: false,
  },
};

const launchContext: AuditContext = {
  appType: "saas",
  stage: "launch-prep",
  hasPayments: true,
  hasUserAccounts: true,
  storesUserData: true,
};

describe("generateReport", () => {
  it("summarizes checklist findings into an ordered report", () => {
    const checklist = runChecklist(facts, launchContext);
    const report = generateReport({
      facts,
      checklist,
      scannedAt: "2026-06-13T00:00:00.000Z",
    });

    expect(report.readinessLabel).toBe("Launch blocked");
    expect(report.executiveSummary).toContain("13/100");
    expect(report.topRisks[0]?.severity).toBe("critical");
    expect(report.nextActions[0]).toContain("Then re-run the scan");
    expect(report.promptQueueSummary).toContain("implementation prompts queued");
  });

  it("returns maintenance guidance when no findings exist", () => {
    const completeChecklist = runChecklist(
      {
        ...facts,
        dependencies: [
          { name: "@clerk/nextjs", version: "^6.0.0", kind: "dependency" },
          { name: "stripe", version: "^17.0.0", kind: "dependency" },
          { name: "posthog-js", version: "^1.0.0", kind: "dependency" },
          { name: "@sentry/nextjs", version: "^8.0.0", kind: "dependency" },
        ],
        signals: {
          ...facts.signals,
          hasEnvExample: true,
          hasTests: true,
          hasMiddleware: true,
          hasAuthDependency: true,
          hasStripeDependency: true,
          hasAnalyticsPlan: true,
          hasAnalyticsDependency: true,
          hasObservabilityPlan: true,
          hasErrorTrackingDependency: true,
          hasAiRules: true,
          hasPaymentRoute: true,
          hasWebhookRoute: true,
          hasWebhookSignatureVerification: true,
          hasLocalEnvFile: false,
          hasEnvGitignoreRule: true,
          hasRateLimitImplementation: true,
        },
      },
      launchContext,
    );

    const report = generateReport({
      facts,
      checklist: completeChecklist,
      scannedAt: "2026-06-13T00:00:00.000Z",
    });

    expect(report.readinessLabel).toBe("Launch Prep ready");
    expect(report.topRisks).toHaveLength(0);
    expect(report.nextActions).toHaveLength(3);
    expect(report.promptQueueSummary).toContain("No implementation prompts");
  });

  it("formats a copyable markdown handoff report", () => {
    const checklist = runChecklist(facts, launchContext);
    const report = generateReport({
      facts,
      checklist,
      scannedAt: "2026-06-13T00:00:00.000Z",
    });
    const markdown = formatMarkdownReport({
      projectName: "Vibe Workspace",
      facts,
      checklist,
      report,
    });

    expect(markdown).toContain("# Vibe Workspace Readiness Report");
    expect(markdown).toContain("Score: 13/100");
    expect(markdown).toContain("- Stage: launch-prep");
    expect(markdown).toContain("## Top Risks");
    expect(markdown).toContain("## Finding 1:");
    expect(markdown).toContain("### Implementation prompt");
  });
});
