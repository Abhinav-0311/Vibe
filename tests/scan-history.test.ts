import { describe, expect, it } from "vitest";
import { addScanToHistory, createScanHistoryItem, parseScanHistory } from "@/lib/scan-history";
import { compareScans, findPreviousComparableScan } from "@/lib/scan-comparison";
import type { ScanApiResponse } from "@/lib/scan-api";

function createFinding(id: string): ScanApiResponse["checklist"]["findings"][number] {
  return {
    id,
    title: id,
    category: "Testing",
    severity: "medium",
    status: "open",
    evidence: "Evidence",
    severityReason: "Reason",
    impact: "Impact",
    fix: "Fix",
    verification: [],
    prompt: "Prompt",
    actionPriority: "recommended",
  };
}

function createScan(scannedAt: string, score: number, findingIds: string[] = []): ScanApiResponse {
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
        hasStartScript: false,
        hasDevelopmentStartScript: false,
        ignoresTypeScriptBuildErrors: false,
        ignoresEslintBuildErrors: false,
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
      findings: findingIds.map(createFinding),
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

  it("adds the newest scan first and removes equivalent snapshots", () => {
    const scan = createScan("2026-06-13T00:00:00.000Z", 100);
    const firstHistory = addScanToHistory([], scan);
    const newerEquivalentScan = createScan("2026-06-13T00:05:00.000Z", 100);
    const secondHistory = addScanToHistory(firstHistory, newerEquivalentScan);

    expect(firstHistory[0]).toEqual(createScanHistoryItem(scan));
    expect(secondHistory).toHaveLength(1);
    expect(secondHistory[0].scan.scannedAt).toBe("2026-06-13T00:05:00.000Z");
  });

  it("compacts equivalent snapshots already saved in local storage", () => {
    const olderScan = createScan("2026-06-13T00:00:00.000Z", 100);
    const newerScan = createScan("2026-06-13T00:05:00.000Z", 100);
    const storedHistory = [
      { ...createScanHistoryItem(newerScan), id: "legacy-newer-id" },
      { ...createScanHistoryItem(olderScan), id: "legacy-older-id" },
    ];

    const history = parseScanHistory(JSON.stringify(storedHistory));

    expect(history).toHaveLength(1);
    expect(history[0].scan.scannedAt).toBe("2026-06-13T00:05:00.000Z");
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

  it("compares only the same source and readiness profile", () => {
    const baseline = createScan("2026-06-13T00:00:00.000Z", 72, ["missing-tests", "missing-env-example"]);
    const current = createScan("2026-06-13T00:05:00.000Z", 86, ["missing-env-example", "missing-rate-limiting"]);
    const comparison = compareScans(baseline, current);

    expect(findPreviousComparableScan([createScanHistoryItem(baseline)], current)).toEqual(baseline);
    expect(comparison.scoreChange).toBe(14);
    expect(comparison.resolvedFindingIds).toEqual(["missing-tests"]);
    expect(comparison.newFindingIds).toEqual(["missing-rate-limiting"]);
    expect(comparison.unchangedFindingIds).toEqual(["missing-env-example"]);

    const differentProfile = {
      ...current,
      checklist: { ...current.checklist, context: { ...current.checklist.context, appType: "content-site" as const } },
    };
    expect(findPreviousComparableScan([createScanHistoryItem(baseline)], differentProfile)).toBeNull();
  });
});
