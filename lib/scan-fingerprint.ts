import { createHash } from "node:crypto";
import type { ScanApiResponse } from "@/lib/scan-api";

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }

  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;

    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
      .join(",")}}`;
  }

  return JSON.stringify(value);
}

export function createScanHash(scan: ScanApiResponse) {
  const fingerprint = {
    scannedProject: scan.scannedProject,
    facts: scan.facts,
    checklist: scan.checklist,
    report: {
      readinessLabel: scan.report.readinessLabel,
      executiveSummary: scan.report.executiveSummary,
      interpretation: scan.report.interpretation,
      topRisks: scan.report.topRisks,
      nextActions: scan.report.nextActions,
      promptQueueSummary: scan.report.promptQueueSummary,
    },
  };

  return createHash("sha256").update(stableStringify(fingerprint)).digest("hex");
}
