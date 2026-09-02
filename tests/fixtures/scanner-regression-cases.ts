import type { AuditContext } from "@/lib/checklist/types";
import type { ScannerFacts } from "@/lib/scanner/types";

type ScannerRegressionCase = {
  name: string;
  context: AuditContext;
  expectedFindingIds?: readonly string[];
  expectedAbsentFindingIds?: readonly string[];
  factOverrides?: {
    apiRoutes?: ScannerFacts["apiRoutes"];
    signals?: Partial<ScannerFacts["signals"]>;
  };
};

export const scannerRegressionCases: readonly ScannerRegressionCase[] = [
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
  {
    name: "prototype SaaS avoids launch-only deployment and API controls",
    context: { stage: "prototype", appType: "saas", hasUserAccounts: false, hasPayments: false, storesUserData: false },
    expectedAbsentFindingIds: ["missing-lockfile", "missing-build-script", "missing-rate-limiting", "missing-auth"],
  },
  {
    name: "credential SaaS flags missing account recovery after launch",
    context: { stage: "launch-prep", appType: "saas", hasUserAccounts: true, hasPayments: false, storesUserData: true },
    factOverrides: { signals: { hasAuthDependency: true, hasCredentialAuthRoute: true } },
    expectedFindingIds: ["missing-account-recovery", "missing-session-termination"],
    expectedAbsentFindingIds: ["missing-auth"],
  },
  {
    name: "paid SaaS requires a payment webhook",
    context: { stage: "launch-prep", appType: "saas", hasUserAccounts: false, hasPayments: true, storesUserData: true },
    factOverrides: { signals: { hasStripeDependency: true, hasWebhookRoute: false } },
    expectedFindingIds: ["missing-payment-webhook"],
    expectedAbsentFindingIds: ["unverified-payment-webhook"],
  },
  {
    name: "paid SaaS rejects an unverified webhook",
    context: { stage: "production", appType: "saas", hasUserAccounts: false, hasPayments: true, storesUserData: true },
    factOverrides: { signals: { hasStripeDependency: true, hasWebhookRoute: true, hasWebhookSignatureVerification: false } },
    expectedFindingIds: ["unverified-payment-webhook"],
  },
  {
    name: "launch API requires health, middleware, and rate-limit signals",
    context: { stage: "launch-prep", appType: "api", hasUserAccounts: false, hasPayments: false, storesUserData: true },
    factOverrides: { apiRoutes: [{ route: "/api/search", file: "app/api/search/route.ts", signals: [] }] },
    expectedFindingIds: ["missing-health-route", "missing-middleware", "missing-rate-limiting"],
  },
  {
    name: "launch content site does not inherit SaaS account requirements",
    context: { stage: "launch-prep", appType: "content-site", hasUserAccounts: false, hasPayments: false, storesUserData: false },
    expectedAbsentFindingIds: ["missing-auth", "missing-stripe", "missing-rate-limiting"],
  },
];
