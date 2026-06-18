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
    checklist: {
      score: scan.checklist.score,
      context: scan.checklist.context,
      summary: scan.checklist.summary,
      findings: scan.checklist.findings.map((finding) => ({
        id: finding.id,
        title: finding.title,
        category: finding.category,
        severity: finding.severity,
        status: finding.status,
        evidence: finding.evidence,
        impact: finding.impact,
        fix: finding.fix,
      })),
    },
  };

  return createHash("sha256").update(stableStringify(fingerprint)).digest("hex");
}
