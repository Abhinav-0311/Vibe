import { describe, expect, it } from "vitest";
import { runChecklist } from "@/lib/checklist/checklist-engine";
import type { AuditContext } from "@/lib/checklist/types";
import type { ScannerFacts } from "@/lib/scanner/types";

const baseFacts: ScannerFacts = {
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
  },
};

const prototypeContext: AuditContext = {
  appType: "saas",
  stage: "prototype",
  hasPayments: false,
  hasUserAccounts: false,
  storesUserData: false,
};

const launchContext: AuditContext = {
  appType: "saas",
  stage: "launch-prep",
  hasPayments: true,
  hasUserAccounts: true,
  storesUserData: true,
};

describe("runChecklist", () => {
  it("keeps prototype scans context-aware and avoids payment/auth blockers", () => {
    const result = runChecklist(baseFacts, prototypeContext);
    const findingIds = result.findings.map((finding) => finding.id);

    expect(result.context.stage).toBe("prototype");
    expect(result.score).toBe(66);
    expect(findingIds).toContain("missing-env-example");
    expect(findingIds).toContain("missing-tests");
    expect(findingIds).toContain("missing-ai-rules");
    expect(findingIds).not.toContain("missing-auth");
    expect(findingIds).not.toContain("missing-stripe");
    expect(findingIds).not.toContain("missing-middleware");
  });

  it("becomes stricter when the app is preparing for launch with users and payments", () => {
    const result = runChecklist(baseFacts, launchContext);
    const findingIds = result.findings.map((finding) => finding.id);

    expect(result.context.stage).toBe("launch-prep");
    expect(result.score).toBe(13);
    expect(result.summary.critical).toBe(1);
    expect(findingIds).toContain("missing-auth");
    expect(findingIds).toContain("missing-stripe");
    expect(findingIds).toContain("missing-middleware");
  });

  it("does not report missing systems when scanner facts show those systems exist", () => {
    const completeFacts: ScannerFacts = {
      ...baseFacts,
      dependencies: [
        { name: "@clerk/nextjs", version: "^6.0.0", kind: "dependency" },
        { name: "stripe", version: "^17.0.0", kind: "dependency" },
        { name: "posthog-js", version: "^1.0.0", kind: "dependency" },
        { name: "@sentry/nextjs", version: "^8.0.0", kind: "dependency" },
      ],
      signals: {
        ...baseFacts.signals,
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
      },
    };

    const result = runChecklist(completeFacts, launchContext);

    expect(result.score).toBe(100);
    expect(result.findings).toHaveLength(0);
  });
});
