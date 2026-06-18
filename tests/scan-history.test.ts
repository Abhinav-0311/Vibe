import { describe, expect, it } from "vitest";
import { addScanToHistory, createScanHistoryItem, parseScanHistory } from "@/lib/scan-history";
import type { ScanApiResponse } from "@/lib/scan-api";

function createScan(scannedAt: string, score: number): ScanApiResponse {
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
        hasWebhookSignatureVerification: false,
        hasHealthRoute: false,
        hasLocalEnvFile: false,
        hasEnvGitignoreRule: false,
        hasRateLimitImplementation: false,
        hasWildcardCors: false,
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
      nextActions: [],
      promptQueueSummary: "No prompts",
    },
  };
}

describe("scan history", () => {
  it("parses missing or invalid history safely", () => {
    expect(parseScanHistory(null)).toEqual([]);
    expect(parseScanHistory("not-json")).toEqual([]);
    expect(parseScanHistory("{}")).toEqual([]);
  });

  it("adds the newest scan first and removes duplicate ids", () => {
    const scan = createScan("2026-06-13T00:00:00.000Z", 100);
    const firstHistory = addScanToHistory([], scan);
    const secondHistory = addScanToHistory(firstHistory, scan);

    expect(firstHistory[0]).toEqual(createScanHistoryItem(scan));
    expect(secondHistory).toHaveLength(1);
  });

  it("keeps only the six newest scans", () => {
    const history = Array.from({ length: 8 }).reduce(
      (currentHistory, _, index) =>
        addScanToHistory(currentHistory, createScan(`2026-06-13T00:0${index}:00.000Z`, 100 - index)),
      [] as ReturnType<typeof addScanToHistory>,
    );

    expect(history).toHaveLength(6);
    expect(history[0].scan.scannedAt).toBe("2026-06-13T00:07:00.000Z");
  });
});
