import { describe, expect, it } from "vitest";
import { inferAuditContext, inferAuditProfile, selectedAuditProfile } from "@/lib/checklist/context-inference";
import type { AuditContext } from "@/lib/checklist/types";
import type { ScannerFacts } from "@/lib/scanner/types";

const requestedContentContext: AuditContext = {
  appType: "content-site",
  stage: "prototype",
  hasPayments: false,
  hasUserAccounts: false,
  storesUserData: false,
};

const baseFacts: ScannerFacts = {
  projectRoot: "E:\\College\\Project\\Portfolio",
  packageManager: "npm",
  framework: {
    name: "Vite React",
    confidence: "high",
  },
  scripts: {
    build: "vite build",
  },
  dependencies: [{ name: "react", version: "^19.0.0", kind: "dependency" }],
  detectedFiles: [],
  apiRoutes: [],
  signals: {
    hasPackageJson: true,
    hasNextConfig: false,
    hasAppRouter: false,
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

describe("inferAuditContext", () => {
  it("keeps a simple public portfolio on the content-site profile", () => {
    const profile = inferAuditProfile(baseFacts, requestedContentContext);

    expect(inferAuditContext(baseFacts, requestedContentContext)).toEqual(requestedContentContext);
    expect(profile).toMatchObject({
      applied: requestedContentContext,
      adjusted: false,
    });
    expect(profile.reasons[0]).toContain("content-site profile");
  });

  it("promotes obvious auth and payment projects from content-site to launch-prep SaaS", () => {
    const facts: ScannerFacts = {
      ...baseFacts,
      dependencies: [
        ...baseFacts.dependencies,
        { name: "@clerk/nextjs", version: "^6.0.0", kind: "dependency" },
        { name: "stripe", version: "^17.0.0", kind: "dependency" },
      ],
      signals: {
        ...baseFacts.signals,
        hasAuthDependency: true,
        hasStripeDependency: true,
      },
    };

    const profile = inferAuditProfile(facts, requestedContentContext);

    expect(profile.applied).toMatchObject({
      appType: "saas",
      stage: "launch-prep",
      hasPayments: true,
      hasUserAccounts: true,
    });
    expect(profile.adjusted).toBe(true);
    expect(profile.reasons).toEqual(
      expect.arrayContaining([
        expect.stringContaining("Auth dependency"),
        expect.stringContaining("Stripe"),
        expect.stringContaining("SaaS"),
      ]),
    );
  });

  it("promotes backend-only projects to the API profile", () => {
    const facts: ScannerFacts = {
      ...baseFacts,
      framework: {
        name: "Express",
        confidence: "medium",
      },
      dependencies: [{ name: "express", version: "^5.0.0", kind: "dependency" }],
      apiRoutes: [{ route: "/health", file: "src/server.ts", signals: ["health"] }],
      signals: {
        ...baseFacts.signals,
        hasHealthRoute: true,
      },
    };

    const profile = inferAuditProfile(facts, requestedContentContext);

    expect(profile.applied).toMatchObject({
      appType: "api",
      stage: "prototype",
      hasPayments: false,
      hasUserAccounts: false,
    });
    expect(profile.adjusted).toBe(true);
    expect(profile.reasons).toEqual(expect.arrayContaining([expect.stringContaining("API project")]));
  });

  it("does not downgrade an explicit SaaS profile", () => {
    const requestedSaasContext: AuditContext = {
      ...requestedContentContext,
      appType: "saas",
      stage: "launch-prep",
      hasUserAccounts: true,
      storesUserData: true,
    };

    const profile = inferAuditProfile(baseFacts, requestedSaasContext);

    expect(inferAuditContext(baseFacts, requestedSaasContext)).toEqual(requestedSaasContext);
    expect(profile).toMatchObject({
      applied: requestedSaasContext,
      adjusted: false,
    });
    expect(profile.reasons[0]).toContain("without adjustment");
  });

  it("keeps a manually selected profile even when automatic inference would promote it", () => {
    const facts: ScannerFacts = {
      ...baseFacts,
      signals: {
        ...baseFacts.signals,
        hasAuthRoute: true,
      },
    };

    expect(inferAuditProfile(facts, requestedContentContext).applied.appType).toBe("saas");
    expect(selectedAuditProfile(requestedContentContext)).toMatchObject({
      applied: requestedContentContext,
      adjusted: false,
    });
  });
});
