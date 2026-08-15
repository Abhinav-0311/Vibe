import type { AuditContext } from "@/lib/checklist/types";

export const scannerRegressionCases = [
  {
    name: "content-site avoids SaaS-only requirements",
    context: { stage: "prototype", appType: "content-site", hasUserAccounts: false, hasPayments: false, storesUserData: false },
    expectedAbsentFindingIds: ["missing-auth", "missing-stripe", "missing-middleware"],
  },
  {
    name: "credential SaaS requires durable account safety",
    context: { stage: "launch-prep", appType: "saas", hasUserAccounts: true, hasPayments: false, storesUserData: true },
    expectedFindingIds: ["missing-auth"],
  },
] as const satisfies readonly { name: string; context: AuditContext; expectedFindingIds?: readonly string[]; expectedAbsentFindingIds?: readonly string[] }[];
