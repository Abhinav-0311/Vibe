import { describe, expect, it } from "vitest";
import { runChecklist } from "@/lib/checklist/checklist-engine";
import type { AuditContext } from "@/lib/checklist/types";
import type { ScannerFacts } from "@/lib/scanner/types";

const baseFacts: ScannerFacts = {
  projectRoot: "E:\\College\\Project\\Vibe",
  packageManager: "npm",
  framework: {
    name: "Next.js",
    confidence: "high",
  },
  scripts: {
    dev: "next dev",
    build: "next build",
  },
  dependencies: [],
  detectedFiles: [],
  apiRoutes: [],
  signals: {
    hasPackageJson: true,
    hasNextConfig: true,
    hasAppRouter: true,
    hasPagesRouter: false,
    hasEnvExample: false,
    hasTests: false,
    hasMiddleware: false,
    hasAuthDependency: false,
    hasStripeDependency: false,
    hasAnalyticsPlan: false,
    hasAnalyticsDependency: false,
    hasObservabilityPlan: false,
    hasErrorTrackingDependency: false,
    hasAiRules: false,
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
};

const prototypeContext: AuditContext = {
  appType: "saas",
  stage: "prototype",
  hasPayments: false,
  hasUserAccounts: false,
  storesUserData: false,
};

const launchContext: AuditContext = {
  appType: "saas",
  stage: "launch-prep",
  hasPayments: true,
  hasUserAccounts: true,
  storesUserData: true,
};

describe("runChecklist", () => {
  it("keeps prototype scans context-aware and avoids payment/auth blockers", () => {
    const result = runChecklist(baseFacts, prototypeContext);
    const findingIds = result.findings.map((finding) => finding.id);

    expect(result.context.stage).toBe("prototype");
    expect(result.score).toBe(66);
    expect(findingIds).toContain("missing-env-example");
    expect(findingIds).toContain("missing-tests");
    expect(findingIds).toContain("missing-ai-rules");
    expect(findingIds).not.toContain("missing-auth");
    expect(findingIds).not.toContain("missing-stripe");
    expect(findingIds).not.toContain("missing-middleware");
  });

  it("becomes stricter when the app is preparing for launch with users and payments", () => {
    const result = runChecklist(baseFacts, launchContext);
    const findingIds = result.findings.map((finding) => finding.id);

    expect(result.context.stage).toBe("launch-prep");
    expect(result.score).toBe(20);
    expect(result.summary.critical).toBe(1);
    expect(findingIds).toContain("missing-auth");
    expect(findingIds).toContain("missing-stripe");
    expect(findingIds).not.toContain("missing-middleware");
  });

  it("does not report missing systems when scanner facts show those systems exist", () => {
    const completeFacts: ScannerFacts = {
      ...baseFacts,
      dependencies: [
        { name: "@clerk/nextjs", version: "^6.0.0", kind: "dependency" },
        { name: "stripe", version: "^17.0.0", kind: "dependency" },
        { name: "posthog-js", version: "^1.0.0", kind: "dependency" },
        { name: "@sentry/nextjs", version: "^8.0.0", kind: "dependency" },
      ],
      signals: {
        ...baseFacts.signals,
        hasEnvExample: true,
        hasTests: true,
        hasMiddleware: true,
        hasAuthDependency: true,
        hasStripeDependency: true,
        hasAnalyticsPlan: true,
        hasAnalyticsDependency: true,
        hasObservabilityPlan: true,
        hasErrorTrackingDependency: true,
        hasAiRules: true,
        hasAuthRoute: true,
        hasCredentialAuthRoute: true,
        hasPasswordRecoveryRoute: true,
        hasSessionManagementRoute: true,
        hasPaymentRoute: true,
        hasWebhookRoute: true,
        hasWebhookSignatureVerification: true,
        hasHealthRoute: true,
        hasLocalEnvFile: false,
        hasEnvGitignoreRule: true,
        hasRateLimitImplementation: true,
        hasWildcardCors: false,
        hasInsecureSessionCookie: false,
        hasLockfile: true,
        hasBuildScript: true,
        hasStartScript: true,
        hasDevelopmentStartScript: false,
        ignoresTypeScriptBuildErrors: false,
        ignoresEslintBuildErrors: false,
      },
    };

    const result = runChecklist(completeFacts, launchContext);

    expect(result.score).toBe(100);
    expect(result.findings).toHaveLength(0);
  });

  it("requires a webhook route when Stripe payments are enabled", () => {
    const stripeFacts: ScannerFacts = {
      ...baseFacts,
      dependencies: [{ name: "stripe", version: "^17.0.0", kind: "dependency" }],
      signals: {
        ...baseFacts.signals,
        hasStripeDependency: true,
      },
    };

    const result = runChecklist(stripeFacts, launchContext);

    expect(result.findings.map((finding) => finding.id)).toContain("missing-payment-webhook");
  });

  it("rejects a Stripe webhook route without signature verification", () => {
    const unverifiedWebhookFacts: ScannerFacts = {
      ...baseFacts,
      dependencies: [{ name: "stripe", version: "^17.0.0", kind: "dependency" }],
      apiRoutes: [
        {
          route: "/api/stripe/webhook",
          file: "app/api/stripe/webhook/route.ts",
          signals: ["payments", "webhook"],
        },
      ],
      signals: {
        ...baseFacts.signals,
        hasStripeDependency: true,
        hasPaymentRoute: true,
        hasWebhookRoute: true,
      },
    };

    const result = runChecklist(unverifiedWebhookFacts, launchContext);
    const findingIds = result.findings.map((finding) => finding.id);

    expect(findingIds).toContain("unverified-payment-webhook");
    expect(findingIds).not.toContain("missing-payment-webhook");
  });

  it("requires a health route for APIs preparing to launch", () => {
    const apiContext: AuditContext = {
      ...launchContext,
      appType: "api",
      hasPayments: false,
      hasUserAccounts: false,
    };
    const result = runChecklist(baseFacts, apiContext);

    expect(result.findings.map((finding) => finding.id)).toContain("missing-health-route");
  });

  it("flags local environment files that are not ignored", () => {
    const unsafeFacts: ScannerFacts = {
      ...baseFacts,
      signals: {
        ...baseFacts.signals,
        hasLocalEnvFile: true,
      },
    };

    const result = runChecklist(unsafeFacts, prototypeContext);

    expect(result.findings.map((finding) => finding.id)).toContain("unignored-environment-file");
  });

  it("requires rate limiting for launch-stage auth routes", () => {
    const authRouteFacts: ScannerFacts = {
      ...baseFacts,
      apiRoutes: [{ route: "/api/auth/login", file: "app/api/auth/login/route.ts", signals: ["auth"] }],
      signals: {
        ...baseFacts.signals,
        hasAuthRoute: true,
      },
    };

    const result = runChecklist(authRouteFacts, launchContext);

    expect(result.findings.map((finding) => finding.id)).toContain("missing-rate-limiting");
    expect(result.findings.map((finding) => finding.id)).toContain("missing-middleware");
  });

  it("does not require deployment artifacts during prototype work", () => {
    const prototypeDeploymentFacts: ScannerFacts = {
      ...baseFacts,
      signals: {
        ...baseFacts.signals,
        hasLockfile: false,
        hasBuildScript: false,
      },
    };

    const result = runChecklist(prototypeDeploymentFacts, prototypeContext);
    const findingIds = result.findings.map((finding) => finding.id);

    expect(findingIds).not.toContain("missing-lockfile");
    expect(findingIds).not.toContain("missing-build-script");
  });

  it("does not require local recovery routes for hosted auth without credential routes", () => {
    const hostedAuthFacts: ScannerFacts = {
      ...baseFacts,
      dependencies: [{ name: "@clerk/nextjs", version: "^6.0.0", kind: "dependency" }],
      signals: {
        ...baseFacts.signals,
        hasAuthDependency: true,
      },
    };

    const result = runChecklist(hostedAuthFacts, launchContext);
    const findingIds = result.findings.map((finding) => finding.id);

    expect(findingIds).not.toContain("missing-account-recovery");
    expect(findingIds).not.toContain("missing-session-termination");
  });

  it("raises wildcard CORS severity for apps handling user data", () => {
    const corsFacts: ScannerFacts = {
      ...baseFacts,
      securityEvidence: { wildcardCorsFiles: ["app/api/data/route.ts"] },
      signals: {
        ...baseFacts.signals,
        hasWildcardCors: true,
      },
    };

    const result = runChecklist(corsFacts, launchContext);
    const corsFinding = result.findings.find((finding) => finding.id === "wildcard-cors");

    expect(corsFinding?.severity).toBe("high");
    expect(corsFinding?.evidence).toContain("app/api/data/route.ts");
  });

  it("requires recovery and logout for local credential auth before launch", () => {
    const credentialFacts: ScannerFacts = {
      ...baseFacts,
      apiRoutes: [{ route: "/api/auth/login", file: "app/api/auth/login/route.ts", signals: ["auth", "credential-auth"] }],
      signals: {
        ...baseFacts.signals,
        hasAuthDependency: true,
        hasAuthRoute: true,
        hasCredentialAuthRoute: true,
        hasRateLimitImplementation: true,
      },
    };

    const result = runChecklist(credentialFacts, launchContext);
    const findingIds = result.findings.map((finding) => finding.id);

    expect(findingIds).toContain("missing-account-recovery");
    expect(findingIds).toContain("missing-session-termination");
  });

  it("flags explicit insecure session cookie settings", () => {
    const insecureCookieFacts: ScannerFacts = {
      ...baseFacts,
      securityEvidence: {
        wildcardCorsFiles: [],
        insecureSessionCookieFiles: ["app/api/auth/login/route.ts"],
      },
      signals: {
        ...baseFacts.signals,
        hasInsecureSessionCookie: true,
      },
    };

    const result = runChecklist(insecureCookieFacts, prototypeContext);
    const cookieFinding = result.findings.find((finding) => finding.id === "insecure-session-cookie");

    expect(cookieFinding?.severity).toBe("high");
    expect(cookieFinding?.evidence).toContain("app/api/auth/login/route.ts");
  });

  it("requires a lockfile and build script before launch", () => {
    const incompleteDeploymentFacts: ScannerFacts = {
      ...baseFacts,
      signals: {
        ...baseFacts.signals,
        hasLockfile: false,
        hasBuildScript: false,
      },
    };

    const result = runChecklist(incompleteDeploymentFacts, launchContext);
    const findingIds = result.findings.map((finding) => finding.id);

    expect(findingIds).toContain("missing-lockfile");
    expect(findingIds).toContain("missing-build-script");
  });

  it("rejects development start commands and disabled build validation", () => {
    const unsafeDeploymentFacts: ScannerFacts = {
      ...baseFacts,
      deploymentEvidence: {
        ignoredTypeScriptBuildFiles: ["next.config.ts"],
        ignoredEslintBuildFiles: ["next.config.ts"],
        startCommand: "next dev",
      },
      signals: {
        ...baseFacts.signals,
        hasStartScript: true,
        hasDevelopmentStartScript: true,
        ignoresTypeScriptBuildErrors: true,
        ignoresEslintBuildErrors: true,
      },
    };

    const result = runChecklist(unsafeDeploymentFacts, launchContext);
    const findingIds = result.findings.map((finding) => finding.id);

    expect(findingIds).toContain("development-start-script");
    expect(findingIds).toContain("disabled-build-validation");
    expect(result.findings.find((finding) => finding.id === "disabled-build-validation")?.evidence).toContain(
      "next.config.ts",
    );
  });
});
