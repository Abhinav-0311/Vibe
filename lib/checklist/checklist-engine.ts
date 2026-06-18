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
