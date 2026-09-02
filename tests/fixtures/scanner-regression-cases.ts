import type { AuditContext } from "@/lib/checklist/types";
import type { ScannerFacts } from "@/lib/scanner/types";

export type ScannerRegressionCase = {
  name: string;
  /** Human-labelled expectation for a context, not an inferred result. */
  rationale: string;
  context: AuditContext;
  expectedFindingIds?: readonly string[];
  expectedAbsentFindingIds?: readonly string[];
  expectedHighFindingIds?: readonly string[];
  factOverrides?: {
    apiRoutes?: ScannerFacts["apiRoutes"];
    signals?: Partial<ScannerFacts["signals"]>;
  };
};

export const scannerRegressionCases: readonly ScannerRegressionCase[] = [
  {
    name: "portfolio avoids SaaS-only requirements",
    rationale: "A public portfolio should not inherit product authentication, payments, or API operational requirements.",
    context: { stage: "prototype", appType: "portfolio", hasUserAccounts: false, hasPayments: false, storesUserData: false },
    expectedAbsentFindingIds: ["missing-auth", "missing-stripe", "missing-middleware"],
    expectedHighFindingIds: [],
  },
  {
    name: "credential SaaS requires durable account safety",
    rationale: "A launch-stage product with user data must have authentication and operational safeguards.",
    context: { stage: "launch-prep", appType: "saas", hasUserAccounts: true, hasPayments: false, storesUserData: true },
    expectedFindingIds: ["missing-auth"],
    expectedHighFindingIds: ["missing-env-example", "missing-tests", "missing-error-tracking"],
  },
  {
    name: "prototype SaaS avoids launch-only deployment and API controls",
    rationale: "A pre-launch prototype should not be blocked by controls that only protect active production traffic.",
    context: { stage: "prototype", appType: "saas", hasUserAccounts: false, hasPayments: false, storesUserData: false },
    expectedAbsentFindingIds: ["missing-lockfile", "missing-build-script", "missing-rate-limiting", "missing-auth"],
    expectedHighFindingIds: ["missing-env-example", "missing-tests"],
  },
  {
    name: "credential SaaS flags missing account recovery after launch",
    rationale: "Credential authentication needs recovery and session termination once users can rely on it.",
    context: { stage: "launch-prep", appType: "saas", hasUserAccounts: true, hasPayments: false, storesUserData: true },
    factOverrides: { signals: { hasAuthDependency: true, hasCredentialAuthRoute: true } },
    expectedFindingIds: ["missing-account-recovery", "missing-session-termination"],
    expectedAbsentFindingIds: ["missing-auth"],
    expectedHighFindingIds: ["missing-account-recovery", "missing-env-example", "missing-tests", "missing-error-tracking"],
  },
  {
    name: "paid SaaS requires a payment webhook",
    rationale: "A payment dependency without a webhook cannot safely synchronize payment state or entitlements.",
    context: { stage: "launch-prep", appType: "saas", hasUserAccounts: false, hasPayments: true, storesUserData: true },
    factOverrides: { signals: { hasStripeDependency: true, hasWebhookRoute: false } },
    expectedFindingIds: ["missing-payment-webhook"],
    expectedAbsentFindingIds: ["unverified-payment-webhook"],
    expectedHighFindingIds: ["missing-env-example", "missing-tests", "missing-error-tracking", "missing-payment-webhook"],
  },
  {
    name: "paid SaaS rejects an unverified webhook",
    rationale: "A webhook route must validate provider signatures before it can change payment state.",
    context: { stage: "production", appType: "saas", hasUserAccounts: false, hasPayments: true, storesUserData: true },
    factOverrides: { signals: { hasStripeDependency: true, hasWebhookRoute: true, hasWebhookSignatureVerification: false } },
    expectedFindingIds: ["unverified-payment-webhook"],
    expectedHighFindingIds: ["missing-env-example", "missing-tests", "missing-error-tracking"],
  },
  {
    name: "launch API requires health, middleware, and rate-limit signals",
    rationale: "A launch-stage API that stores data must expose minimal health and abuse-protection controls.",
    context: { stage: "launch-prep", appType: "api", hasUserAccounts: false, hasPayments: false, storesUserData: true },
    factOverrides: { apiRoutes: [{ route: "/api/search", file: "app/api/search/route.ts", signals: [] }] },
    expectedFindingIds: ["missing-health-route", "missing-middleware", "missing-rate-limiting"],
    expectedHighFindingIds: ["missing-env-example", "missing-tests", "missing-error-tracking", "missing-rate-limiting"],
  },
  {
    name: "launch content site does not inherit SaaS account requirements",
    rationale: "A content site without accounts, payments, or stored data should not be scored as a SaaS product.",
    context: { stage: "launch-prep", appType: "content-site", hasUserAccounts: false, hasPayments: false, storesUserData: false },
    expectedAbsentFindingIds: ["missing-auth", "missing-stripe", "missing-rate-limiting"],
    expectedHighFindingIds: [],
  },
];
