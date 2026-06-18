import { describe, expect, it } from "vitest";
import type { ChecklistResult } from "@/lib/checklist/types";
import type { ScannerFacts } from "@/lib/scanner/types";
import { generateSetupPack } from "@/lib/setup-pack/setup-pack-generator";

const facts: ScannerFacts = {
  projectRoot: "E:\\College\\Project\\Vibe",
  packageManager: "npm",
  framework: { name: "Next.js", confidence: "high" },
  scripts: { test: "vitest run", build: "next build" },
  dependencies: [{ name: "next", version: "15.5.19", kind: "dependency" }],
  detectedFiles: [],
  apiRoutes: [],
  signals: {
    hasPackageJson: true,
    hasNextConfig: true,
    hasAppRouter: true,
    hasPagesRouter: false,
    hasEnvExample: true,
    hasTests: true,
    hasMiddleware: false,
    hasAuthDependency: false,
    hasStripeDependency: false,
    hasAnalyticsPlan: true,
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
    hasLocalEnvFile: true,
    hasEnvGitignoreRule: true,
    hasRateLimitImplementation: false,
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

const checklist: ChecklistResult = {
  score: 72,
  context: {
    appType: "saas",
    stage: "launch-prep",
    hasPayments: true,
    hasUserAccounts: true,
    storesUserData: true,
  },
  findings: [
    {
      id: "missing-ai-rules",
      title: "No durable AI rules file detected",
      category: "AI Workspace",
      severity: "high",
      status: "open",
      evidence: "No rules file.",
      impact: "Context is lost.",
      fix: "Add AGENTS.md.",
      prompt: "Create AGENTS.md.",
    },
  ],
  summary: { critical: 0, high: 1, medium: 0, low: 0 },
};

describe("generateSetupPack", () => {
  it("creates the complete evidence-backed workspace structure", () => {
    const pack = generateSetupPack({ projectName: "Vibe", facts, checklist });

    expect(pack.artifacts.map((artifact) => artifact.path)).toEqual([
      "AGENTS.md",
      "memory/product.md",
      "memory/decisions.md",
      "memory/roadmap.md",
      "memory/user-profile.md",
      "memory/session-start.md",
      "memory/integrations.md",
    ]);
    expect(pack.artifacts.find((artifact) => artifact.path === "AGENTS.md")?.content).toContain(
      "- Framework: Next.js (high confidence)",
    );
    expect(pack.artifacts.find((artifact) => artifact.path === "memory/product.md")?.content).toContain(
      "- Pricing model: TODO",
    );
    expect(pack.artifacts.find((artifact) => artifact.path === "memory/user-profile.md")?.content).toContain(
      "Do not invent demographics",
    );
  });

  it("turns current findings and scripts into session actions", () => {
    const pack = generateSetupPack({ projectName: "Vibe", facts, checklist });
    const session = pack.artifacts.find((artifact) => artifact.path === "memory/session-start.md")?.content;

    expect(session).toContain("No durable AI rules file detected (high)");
    expect(session).toContain("`npm run test`");
    expect(session).toContain("`npm run build`");
  });

  it("does not place credential values in the integration artifact", () => {
    const pack = generateSetupPack({ projectName: "Vibe", facts, checklist });
    const integrations = pack.artifacts.find((artifact) => artifact.kind === "integration")?.content ?? "";

    expect(integrations).toContain("Never place credentials");
    expect(integrations).not.toMatch(/sk-[A-Za-z0-9]/);
  });
});
