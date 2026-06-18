import type { AuditFinding, Severity } from "@/lib/mock-audit";
import type { ScannerFacts } from "@/lib/scanner/types";
import type { AuditContext, ChecklistResult, ChecklistRule } from "./types";

function finding({
  id,
  title,
  category,
  severity,
  evidence,
  impact,
  fix,
  prompt,
}: Omit<AuditFinding, "status">): AuditFinding {
  return {
    id,
    title,
    category,
    severity,
    status: "open",
    evidence,
    impact,
    fix,
    prompt,
  };
}

const rules: ChecklistRule[] = [
  {
    id: "unignored-environment-file",
    category: "Security",
    severity: "critical",
    evaluate: (facts) => {
      if (!facts.signals.hasLocalEnvFile || facts.signals.hasEnvGitignoreRule) return null;

      return finding({
        id: "unignored-environment-file",
        title: "Local environment files are not fully ignored",
        category: "Security",
        severity: "critical",
        evidence:
          "A local environment file was detected, but .gitignore does not cover every detected environment filename.",
        impact:
          "API keys, database passwords, signing secrets, or other credentials could be committed and exposed in repository history.",
        fix: "Add matching environment-file rules to .gitignore and remove already tracked files from Git history safely.",
        prompt:
          "Inspect only environment filenames and .gitignore rules; do not print secret values. Add ignore patterns covering every local environment file while keeping .env.example tracked. Check whether any secret file is already tracked, remove it from the Git index without deleting the local file, and explain that exposed credentials must be rotated.",
      });
    },
  },
  {
    id: "missing-env-example",
    category: "Deployment",
    severity: "high",
    evaluate: (facts) => {
      if (facts.signals.hasEnvExample) return null;

      return finding({
        id: "missing-env-example",
        title: "Environment variable example file is missing",
        category: "Deployment",
        severity: "high",
        evidence: "No .env.example file was detected in the project root.",
        impact:
          "New deployments and collaborators can miss required secrets or configure production incorrectly.",
        fix: "Create a .env.example file that lists required environment variables without real secret values.",
        prompt:
          "Inspect the project for environment variable usage. Create a safe .env.example file that lists every required variable with placeholder values, add short comments where useful, and do not include real secrets.",
      });
    },
  },
  {
    id: "missing-tests",
    category: "Testing",
    severity: "high",
    evaluate: (facts) => {
      if (facts.signals.hasTests) return null;

      return finding({
        id: "missing-tests",
        title: "No test setup detected",
        category: "Testing",
        severity: "high",
        evidence: "No tests, __tests__ folder, Vitest config, Jest config, or Playwright config was detected.",
        impact:
          "Core behavior can regress silently as the app changes, especially around auth, payments, and scanner logic.",
        fix: "Add a minimal test setup and start with scanner/checklist unit tests.",
        prompt:
          "Add a minimal test setup for this Next.js TypeScript project. Prioritize unit tests for scanner and checklist logic before UI tests. Keep the setup lightweight and document the test command in package.json.",
      });
    },
  },
  {
    id: "missing-middleware",
    category: "Security",
    severity: "medium",
    evaluate: (facts, context) => {
      if (context.stage === "prototype") return null;
      if (facts.signals.hasMiddleware) return null;

      return finding({
        id: "missing-middleware",
        title: "No request middleware detected",
        category: "Security",
        severity: "medium",
        evidence: "No middleware.ts or middleware.js file was detected.",
        impact:
          "The project may lack a central place for request protection, route guards, redirects, or coarse rate-limit checks.",
        fix: "Add middleware when protected routes, auth redirects, or request-level security controls are introduced.",
        prompt:
          "Review the app routes and identify which routes should be protected. Add a minimal Next.js middleware.ts only if it is needed for auth redirects, route protection, or request-level safeguards. Avoid adding unused middleware.",
      });
    },
  },
  {
    id: "missing-rate-limiting",
    category: "Security",
    severity: "high",
    evaluate: (facts, context) => {
      if (context.stage === "prototype" || facts.signals.hasRateLimitImplementation) return null;

      const protectsAuth = context.hasUserAccounts && facts.signals.hasAuthRoute;
      const protectsApi = context.appType === "api" && facts.apiRoutes.length > 0;
      if (!protectsAuth && !protectsApi) return null;

      return finding({
        id: "missing-rate-limiting",
        title: "No rate-limiting evidence on sensitive API routes",
        category: "Security",
        severity: "high",
        evidence:
          "Sensitive API routes were detected, but no known rate-limit package, middleware pattern, or HTTP 429 handling was found.",
        impact:
          "Attackers can automate login attempts or overwhelm public endpoints, increasing account takeover and availability risk.",
        fix: "Apply IP- and account-aware throttling to sensitive endpoints and return a controlled 429 response.",
        prompt:
          "Inspect the detected sensitive API routes and add production-appropriate rate limiting. Prefer the project's existing infrastructure, use both IP and account identifiers where available, return HTTP 429 with a safe retry response, avoid limiting trusted webhook delivery, and add tests for repeated requests and reset behavior.",
      });
    },
  },
  {
    id: "wildcard-cors",
    category: "Security",
    severity: "high",
    evaluate: (facts, context) => {
      if (!facts.signals.hasWildcardCors) return null;

      const severity: Severity =
        context.stage === "prototype" && !context.hasUserAccounts && !context.storesUserData
          ? "medium"
          : "high";
      const evidenceFiles = facts.securityEvidence?.wildcardCorsFiles ?? [];
      const evidenceSuffix = evidenceFiles.length > 0 ? ` Found in ${evidenceFiles.join(", ")}.` : "";

      return finding({
        id: "wildcard-cors",
        title: "Wildcard CORS policy detected",
        category: "Security",
        severity,
        evidence: `A CORS configuration allows every origin with Access-Control-Allow-Origin: * or origin: *.${evidenceSuffix}`,
        impact:
          "Untrusted websites may be able to call public API endpoints from a user's browser, expanding abuse and data-exposure risk.",
        fix: "Replace wildcard origins with a small environment-specific allowlist and reject unknown origins.",
        prompt:
          "Inspect the files named in the CORS finding. Replace wildcard origin access with an explicit allowlist loaded from safe configuration, handle requests with no Origin header deliberately, add Vary: Origin when reflecting approved origins, and add tests for approved and rejected origins. Do not combine wildcard origins with credentials.",
      });
    },
  },
  {
    id: "missing-auth",
    category: "Auth",
    severity: "critical",
    evaluate: (facts, context) => {
      if (!context.hasUserAccounts) return null;
      if (facts.signals.hasAuthDependency) return null;

      return finding({
        id: "missing-auth",
        title: "No authentication provider detected",
        category: "Auth",
        severity: "critical",
        evidence:
          "No Clerk, NextAuth, Supabase Auth helper, or similar auth dependency was detected in package.json.",
        impact:
          "A SaaS app cannot safely handle user accounts, protected data, or billing entitlements without a reliable auth layer.",
        fix: "Choose an auth provider and define signup, login, session, logout, and account recovery flows.",
        prompt:
          "Recommend an authentication approach for this Next.js app. Compare Clerk and Supabase Auth briefly, then implement the chosen provider with signup, login, logout, protected route handling, and environment variable documentation.",
      });
    },
  },
  {
    id: "missing-account-recovery",
    category: "Auth",
    severity: "high",
    evaluate: (facts, context) => {
      if (context.stage === "prototype" || !context.hasUserAccounts) return null;
      if (!facts.signals.hasCredentialAuthRoute || facts.signals.hasPasswordRecoveryRoute) return null;

      return finding({
        id: "missing-account-recovery",
        title: "No account recovery route detected",
        category: "Auth",
        severity: "high",
        evidence:
          "Local credential-auth routes were detected, but no forgot-password, recovery, or password-reset route was found.",
        impact:
          "Users who lose access may be permanently locked out or require unsafe manual account intervention.",
        fix: "Add a time-limited, single-use account recovery flow with neutral responses and secure token storage.",
        prompt:
          "Inspect the local credential-auth implementation and add a secure account recovery flow. Use short-lived single-use tokens, store only token hashes, return neutral responses that do not reveal account existence, invalidate active reset tokens after success, rate limit requests, and add tests for expiry, reuse, and unknown emails.",
      });
    },
  },
  {
    id: "missing-session-termination",
    category: "Auth",
    severity: "medium",
    evaluate: (facts, context) => {
      if (context.stage === "prototype" || !context.hasUserAccounts) return null;
      if (!facts.signals.hasCredentialAuthRoute || facts.signals.hasSessionManagementRoute) return null;

      return finding({
        id: "missing-session-termination",
        title: "No logout or session-management route detected",
        category: "Auth",
        severity: "medium",
        evidence:
          "Local credential-auth routes were detected, but no logout, signout, or session route was found.",
        impact: "Users may be unable to reliably terminate an active session on shared or compromised devices.",
        fix: "Add logout behavior that invalidates the server session and clears the client cookie safely.",
        prompt:
          "Inspect the current session model and add a secure logout/session termination flow. Invalidate the server-side session where applicable, clear the cookie with matching path and domain attributes, use POST for state-changing logout actions, and add tests proving the session cannot be reused.",
      });
    },
  },
  {
    id: "insecure-session-cookie",
    category: "Auth",
    severity: "high",
    evaluate: (facts) => {
      if (!facts.signals.hasInsecureSessionCookie) return null;

      const evidenceFiles = facts.securityEvidence?.insecureSessionCookieFiles ?? [];
      const evidenceSuffix = evidenceFiles.length > 0 ? ` Found in ${evidenceFiles.join(", ")}.` : "";

      return finding({
        id: "insecure-session-cookie",
        title: "Unsafe session cookie option detected",
        category: "Auth",
        severity: "high",
        evidence: `An auth route or middleware explicitly disables httpOnly or secure cookie protection.${evidenceSuffix}`,
        impact:
          "Client-side scripts or unencrypted transport may expose reusable session credentials to attackers.",
        fix: "Use httpOnly cookies and require secure transport outside deliberate local-development handling.",
        prompt:
          "Inspect the files named in this finding and harden session cookie settings. Use httpOnly, secure in production, an appropriate sameSite policy, a narrow path and domain, and bounded expiry. Preserve local development behavior without shipping insecure production defaults, then add configuration tests.",
      });
    },
  },
  {
    id: "missing-stripe",
    category: "Payments",
    severity: "medium",
    evaluate: (facts, context) => {
      if (!context.hasPayments) return null;
      if (facts.signals.hasStripeDependency) return null;

      return finding({
        id: "missing-stripe",
        title: "No payment dependency detected",
        category: "Payments",
        severity: "medium",
        evidence: "No stripe or @stripe/stripe-js dependency was detected.",
        impact:
          "If this is intended to become a paid product, pricing, checkout, webhooks, and entitlement checks are not implemented yet.",
        fix: "Add payments only when the product has a clear paid workflow and entitlement model.",
        prompt:
          "Design a minimal Stripe payment architecture for this Next.js SaaS. Include checkout, webhook verification, subscription status storage, entitlement checks, failed payment handling, and testing notes. Do not implement until the data model is clear.",
      });
    },
  },
  {
    id: "missing-payment-webhook",
    category: "Payments",
    severity: "high",
    evaluate: (facts, context) => {
      if (!context.hasPayments || !facts.signals.hasStripeDependency) return null;
      if (facts.signals.hasWebhookRoute) return null;

      return finding({
        id: "missing-payment-webhook",
        title: "No payment webhook route detected",
        category: "Payments",
        severity: "high",
        evidence:
          "Stripe is installed and payments are enabled, but no API route containing webhook was detected.",
        impact:
          "Checkout may succeed without reliably updating subscriptions, entitlements, failed payments, or cancellations.",
        fix: "Add a server-side Stripe webhook route with signature verification and idempotent event handling.",
        prompt:
          "Inspect the existing payment architecture and add a Stripe webhook route. Verify the raw request body with the Stripe signing secret, handle subscription and payment lifecycle events idempotently, persist entitlement changes, and add tests for invalid signatures and repeated events.",
      });
    },
  },
  {
    id: "unverified-payment-webhook",
    category: "Payments",
    severity: "critical",
    evaluate: (facts, context) => {
      if (!context.hasPayments || !facts.signals.hasStripeDependency) return null;
      if (!facts.signals.hasWebhookRoute || facts.signals.hasWebhookSignatureVerification) return null;

      return finding({
        id: "unverified-payment-webhook",
        title: "Stripe webhook signature verification is missing",
        category: "Payments",
        severity: "critical",
        evidence:
          "A webhook API route and Stripe dependency were detected, but no Stripe webhooks.constructEvent verification call was found in the webhook route.",
        impact:
          "A forged request could grant access, cancel accounts, or corrupt subscription and payment state.",
        fix: "Verify the raw webhook body and Stripe-Signature header before processing any event.",
        prompt:
          "Inspect the detected Stripe webhook route and add signature verification using stripe.webhooks.constructEvent or constructEventAsync. Preserve the raw request body, read the Stripe-Signature header, reject missing or invalid signatures before processing events, keep error responses safe, and add tests for valid and forged requests.",
      });
    },
  },
  {
    id: "missing-health-route",
    category: "Reliability",
    severity: "medium",
    evaluate: (facts, context) => {
      if (context.appType !== "api" || context.stage === "prototype") return null;
      if (facts.signals.hasHealthRoute) return null;

      return finding({
        id: "missing-health-route",
        title: "No API health endpoint detected",
        category: "Reliability",
        severity: "medium",
        evidence: "No API route containing health or status was detected.",
        impact:
          "Deployment platforms and operators cannot distinguish a healthy service from one that is running but unable to serve requests.",
        fix: "Add a minimal health endpoint that reports service readiness without exposing secrets.",
        prompt:
          "Add a lightweight health endpoint for this API. Return a stable status response, include only safe dependency readiness checks, avoid exposing configuration or secrets, and add a test for healthy and degraded responses.",
      });
    },
  },
  {
    id: "missing-analytics",
    category: "Analytics",
    severity: "medium",
    evaluate: (facts, context) => {
      if (facts.signals.hasAnalyticsDependency) return null;
      if (context.stage === "prototype" && facts.signals.hasAnalyticsPlan) return null;

      return finding({
        id: "missing-analytics",
        title: "No product analytics detected",
        category: "Analytics",
        severity: "medium",
        evidence: "No PostHog, Vercel Analytics, Mixpanel, or similar analytics dependency was detected.",
        impact:
          "You will not know where users drop off, which findings they copy, or whether scans lead to fixes.",
        fix: "Track a small set of meaningful product events.",
        prompt:
          "Add a minimal analytics plan for this product. Define events for project created, scan started, scan completed, finding selected, prompt copied, and scan failed. Recommend the lightest implementation path for a Next.js app.",
      });
    },
  },
  {
    id: "missing-error-tracking",
    category: "Reliability",
    severity: "high",
    evaluate: (facts, context) => {
      if (facts.signals.hasErrorTrackingDependency) return null;
      if (context.stage === "prototype" && facts.signals.hasObservabilityPlan) return null;

      if (context.stage === "prototype") {
        return finding({
          id: "missing-error-tracking",
          title: "Error tracking is not planned yet",
          category: "Reliability",
          severity: "medium",
          evidence: "No Sentry, Highlight, Bugsnag, or equivalent error tracking dependency was detected.",
          impact:
            "This is acceptable for a prototype, but scanner and API failures will need visibility before launch.",
          fix: "Plan error tracking before the first real users run scans.",
          prompt:
            "Create a lightweight observability plan for this Next.js prototype. Explain when to add Sentry or an equivalent tool, which errors to capture first, and what environment variables will be needed before launch.",
        });
      }

      return finding({
        id: "missing-error-tracking",
        title: "No error tracking detected",
        category: "Reliability",
        severity: "high",
        evidence: "No Sentry, Highlight, Bugsnag, or equivalent error tracking dependency was detected.",
        impact:
          "Scanner failures, API errors, and report generation issues can happen silently in production.",
        fix: "Add error tracking before real users run scans.",
        prompt:
          "Add production error tracking to this Next.js app. Capture API route errors, scanner failures, and client rendering errors. Keep the setup minimal and document required environment variables in .env.example.",
      });
    },
  },
  {
    id: "missing-ai-rules",
    category: "AI Workspace",
    severity: "high",
    evaluate: (facts) => {
      if (facts.signals.hasAiRules) return null;

      return finding({
        id: "missing-ai-rules",
        title: "No durable AI rules file detected",
        category: "AI Workspace",
        severity: "high",
        evidence: "No AGENTS.md, .cursor/rules, or .cursorrules file was detected in the project root.",
        impact:
          "AI coding tools may lose product context, design constraints, architecture boundaries, and mentoring expectations between sessions.",
        fix: "Add a project-level AI rules file that captures operating rules and product context.",
        prompt:
          "Create a project-specific AGENTS.md. Include the product purpose, target user, technical stack, design constraints, coding standards, safety boundaries, and instructions to explain important steps before implementation.",
      });
    },
  },
];

const defaultContext: AuditContext = {
  appType: "saas",
  stage: "prototype",
  hasPayments: false,
  hasUserAccounts: false,
  storesUserData: false,
};

function severityPenalty(severity: Severity, context: AuditContext) {
  const stageMultiplier = context.stage === "prototype" ? 0.65 : context.stage === "launch-prep" ? 1 : 1.2;

  if (severity === "critical") return 18;
  if (severity === "high") return Math.round(12 * stageMultiplier);
  if (severity === "medium") return Math.round(7 * stageMultiplier);
  return Math.round(3 * stageMultiplier);
}

export function runChecklist(facts: ScannerFacts, context: AuditContext = defaultContext): ChecklistResult {
  const findings = rules.flatMap((rule) => {
    const result = rule.evaluate(facts, context);
    return result ? [result] : [];
  });

  const totalPenalty = findings.reduce((sum, item) => sum + severityPenalty(item.severity, context), 0);
  const score = Math.max(0, 100 - totalPenalty);

  return {
    score,
    context,
    findings,
    summary: {
      critical: findings.filter((item) => item.severity === "critical").length,
      high: findings.filter((item) => item.severity === "high").length,
      medium: findings.filter((item) => item.severity === "medium").length,
      low: findings.filter((item) => item.severity === "low").length,
    },
  };
}
