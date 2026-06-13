import type { AuditFinding, Severity } from "@/lib/mock-audit";
import type { ScannerFacts } from "@/lib/scanner/types";

export type ChecklistRule = {
  id: string;
  category: string;
  severity: Severity;
  evaluate: (facts: ScannerFacts, context: AuditContext) => AuditFinding | null;
};

export type AuditContext = {
  appType: "saas" | "marketplace" | "internal-tool" | "content-site" | "api" | "unknown";
  stage: "prototype" | "launch-prep" | "production";
  hasPayments: boolean;
  hasUserAccounts: boolean;
  storesUserData: boolean;
};

export type ChecklistResult = {
  score: number;
  context: AuditContext;
  findings: AuditFinding[];
  summary: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
};
