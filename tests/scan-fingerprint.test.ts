import { describe, expect, it } from "vitest";
import { createScanHash } from "@/lib/scan-fingerprint";
import type { ScanApiResponse } from "@/lib/scan-api";

function createScan(scannedAt: string, score = 100): ScanApiResponse {
  return {
    scannedProject: "current workspace",
    scannedAt,
    facts: {
      projectRoot: "E:\\College\\Project\\Vibe",
      packageManager: "npm",
      framework: {
        name: "Next.js",
        confidence: "high",
      },
      scripts: {},
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
        hasPaymentRoute: false,
        hasWebhookRoute: false,
        hasHealthRoute: false,
        hasLocalEnvFile: false,
        hasEnvGitignoreRule: false,
        hasRateLimitImplementation: false,
      },
    },
    checklist: {
      score,
      context: {
        appType: "saas",
        stage: "prototype",
        hasPayments: false,
        hasUserAccounts: false,
        storesUserData: false,
      },
      findings: [],
      summary: {
        critical: 0,
        high: 0,
        medium: 0,
        low: 0,
      },
    },
    report: {
      generatedAt: scannedAt,
      readinessLabel: "Prototype ready",
      executiveSummary: "Summary",
      interpretation: "Interpretation",
      topRisks: [],
      nextActions: ["Next action"],
      promptQueueSummary: "No prompts",
    },
  };
}

describe("createScanHash", () => {
  it("ignores scan timestamps", () => {
    expect(createScanHash(createScan("2026-06-13T00:00:00.000Z"))).toBe(
      createScanHash(createScan("2026-06-13T00:01:00.000Z")),
    );
  });

  it("changes when meaningful scan content changes", () => {
    expect(createScanHash(createScan("2026-06-13T00:00:00.000Z", 100))).not.toBe(
      createScanHash(createScan("2026-06-13T00:00:00.000Z", 80)),
    );
  });
});
