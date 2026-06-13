import type { Severity } from "@/lib/mock-audit";

export type GeneratedReportRisk = {
  title: string;
  severity: Severity;
  category: string;
  impact: string;
  suggestedFix: string;
};

export type GeneratedReport = {
  generatedAt: string;
  readinessLabel: string;
  executiveSummary: string;
  interpretation: string;
  topRisks: GeneratedReportRisk[];
  nextActions: string[];
  promptQueueSummary: string;
};
