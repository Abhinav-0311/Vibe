import type { AuditContext, ChecklistResult } from "@/lib/checklist/types";
import type { ScannerFacts } from "@/lib/scanner/types";
import type { SetupArtifact, SetupPack } from "@/lib/setup-pack/types";

type GenerateSetupPackInput = {
  projectName: string;
  facts: ScannerFacts;
  checklist: ChecklistResult;
};

function titleCase(value: string) {
  return value
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function yesNo(value: boolean) {
  return value ? "Yes" : "No";
}

function productCapabilities(context: AuditContext) {
  return [
    `- User accounts: ${yesNo(context.hasUserAccounts)}`,
    `- Payments: ${yesNo(context.hasPayments)}`,
    `- User data storage: ${yesNo(context.storesUserData)}`,
  ].join("\n");
}

function detectedDependencies(facts: ScannerFacts) {
  const dependencies = facts.dependencies.slice(0, 12).map((dependency) => `- ${dependency.name}: ${dependency.version}`);
  return dependencies.length > 0 ? dependencies.join("\n") : "- No dependencies were detected.";
}

function verificationCommands(facts: ScannerFacts) {
  const prefix = facts.packageManager === "unknown" ? "npm" : facts.packageManager;
  const commands: string[] = [];

  if (facts.scripts.test) commands.push(`- Tests: \`${prefix} run test\``);
  if (facts.scripts.lint) commands.push(`- Lint: \`${prefix} run lint\``);
  if (facts.scripts.build) commands.push(`- Production build: \`${prefix} run build\``);

  return commands.length > 0
    ? commands.join("\n")
    : "- TODO: define the project's test, lint, and production-build commands.";
}

function createRulesArtifact(input: GenerateSetupPackInput): SetupArtifact {
  const { projectName, facts, checklist } = input;
  const context = checklist.context;

  return {
    id: "agents-rules",
    path: "AGENTS.md",
    title: "AI operating rules",
    description: "Durable product, engineering, safety, and mentoring constraints for coding agents.",
    kind: "rules",
    content: `# AGENTS.md

## Product

- Project: ${projectName}
- Product type: ${titleCase(context.appType)}
- Current stage: ${titleCase(context.stage)}
- Purpose: TODO - describe the user problem this product solves in one sentence.
- Target user: TODO - name the primary user and their level of expertise.

## Evidence-Backed Stack

- Framework: ${facts.framework.name} (${facts.framework.confidence} confidence)
- Package manager: ${facts.packageManager}
- App Router detected: ${yesNo(facts.signals.hasAppRouter)}
- Pages Router detected: ${yesNo(facts.signals.hasPagesRouter)}

Detected dependencies:
${detectedDependencies(facts)}

## Product Capabilities

${productCapabilities(context)}

Do not assume missing capabilities exist. Confirm product behavior from code or ask before changing scope.

## Working Method

1. Explain the intended change and important tradeoffs before implementation.
2. Read the relevant code and preserve existing project patterns.
3. Keep changes narrowly scoped; do not rewrite unrelated modules.
4. Use structured parsers and typed interfaces instead of fragile text manipulation.
5. Add tests proportional to the behavioral risk.
6. Report what changed, what was verified, and what remains uncertain.

## Safety Boundaries

- Never print, copy, commit, or expose secret values.
- Keep local environment files untracked and document variables in \`.env.example\`.
- Do not execute code from uploaded or untrusted repositories during inspection.
- Treat authentication, payments, user data, and deployment changes as high-risk work.
- Do not claim that a scan or test proves complete security.
- Ask before destructive database, filesystem, deployment, or Git operations.

## Design Constraints

- Preserve the existing visual language before introducing new patterns.
- Prioritize clear hierarchy, accessibility, responsive behavior, and complete interaction states.
- Every user-facing workflow needs loading, empty, error, disabled, hover, and focus behavior where applicable.
- Remove decorative elements that do not improve comprehension or task completion.

## Verification

${verificationCommands(facts)}

Definition of done: the requested behavior works, relevant checks pass, errors are actionable, documentation is current, and no unrelated changes were introduced.
`,
  };
}

function createProductMemoryArtifact(input: GenerateSetupPackInput): SetupArtifact {
  const { projectName, facts, checklist } = input;
  const context = checklist.context;

  return {
    id: "product-memory",
    path: "memory/product.md",
    title: "Product memory",
    description: "Stable product facts separated from assumptions that still need confirmation.",
    kind: "memory",
    content: `# Product Memory

## Confirmed From This Scan

- Project: ${projectName}
- Product type: ${titleCase(context.appType)}
- Delivery stage: ${titleCase(context.stage)}
- Framework: ${facts.framework.name}
- Package manager: ${facts.packageManager}
- Readiness score at generation: ${checklist.score}/100
${productCapabilities(context)}

## Product Definition

- Primary user: TODO
- Core problem: TODO
- Main workflow: TODO
- Success metric: TODO
- Non-goals: TODO

## Commercial Context

- Pricing model: TODO - do not infer pricing from payment dependencies.
- Plans and limits: TODO
- Trial or free tier: TODO
- Refund or cancellation policy: TODO

## Voice And Experience

- Brand voice: TODO
- Accessibility commitments: TODO
- Supported devices and browsers: TODO
- User support channel: TODO

## Maintenance Rule

Update this file only when a product fact changes. Keep temporary tasks in the roadmap and architectural choices in the decision log.
`,
  };
}

function createDecisionMemoryArtifact(): SetupArtifact {
  return {
    id: "decision-memory",
    path: "memory/decisions.md",
    title: "Decision memory",
    description: "A durable record of technical and product decisions, alternatives, and consequences.",
    kind: "memory",
    content: `# Decision Log

Record decisions that future contributors and coding agents must not silently reverse.

## Entry Template

### YYYY-MM-DD - Decision title

- Status: proposed | accepted | superseded
- Context: What problem or constraint required a decision?
- Decision: What was chosen?
- Alternatives: What other options were considered?
- Consequences: What becomes easier, harder, or risky?
- Evidence: Link to code, issue, test, or document.
- Review trigger: What future change should cause this decision to be revisited?

## Current Decisions

TODO - add the first accepted architectural or product decision.
`,
  };
}

function createRoadmapMemoryArtifact(input: GenerateSetupPackInput): SetupArtifact {
  const priorities = input.checklist.findings.slice(0, 5);

  return {
    id: "roadmap-memory",
    path: "memory/roadmap.md",
    title: "Roadmap memory",
    description: "Current priorities separated from later ideas so agents do not expand scope silently.",
    kind: "memory",
    content: `# Roadmap

## Now - Readiness Work From This Scan

${
  priorities.length > 0
    ? priorities.map((finding) => `- [ ] ${finding.title} (${finding.severity})`).join("\n")
    : "- [ ] Maintain the current readiness baseline and re-scan after scope changes."
}

## Next

- [ ] TODO - add the next validated product outcome.

## Later

- [ ] TODO - add ideas that are useful but not currently committed.

## Explicit Non-Goals

- TODO - record features or markets that should not be pursued in the current stage.

## Update Rule

Move work between Now, Next, and Later only after the product owner confirms the priority. A coding agent must not promote an idea into active scope by itself.
`,
  };
}

function createUserProfileArtifact(input: GenerateSetupPackInput): SetupArtifact {
  const context = input.checklist.context;

  return {
    id: "user-profile-memory",
    path: "memory/user-profile.md",
    title: "User profile memory",
    description: "Known user-facing capabilities plus explicit research gaps about the primary audience.",
    kind: "memory",
    content: `# Primary User Profile

## Known Product Context

- Product type: ${titleCase(context.appType)}
- Product stage: ${titleCase(context.stage)}
${productCapabilities(context)}

## User Definition

- Primary user: TODO
- Job to be done: TODO
- Current workaround: TODO
- Technical confidence: TODO
- Device and environment: TODO
- Accessibility needs: TODO

## Success And Friction

- Desired outcome: TODO
- Time to first value: TODO
- Main failure or abandonment point: TODO
- Trust concern: TODO
- Support expectation: TODO

## Evidence

- Interview or research source: TODO
- Usage data source: TODO
- Last reviewed: TODO

Do not invent demographics, behavior, needs, or preferences. Update this file from user research, support evidence, or confirmed product decisions.
`,
  };
}

function createSessionArtifact(input: GenerateSetupPackInput): SetupArtifact {
  const { facts, checklist } = input;
  const topFindings = checklist.findings.slice(0, 3);
  const priorities = topFindings.length
    ? topFindings.map((finding) => `- [ ] ${finding.title} (${finding.severity})`).join("\n")
    : "- [ ] No open readiness finding was present when this pack was generated.";

  return {
    id: "session-start",
    path: "memory/session-start.md",
    title: "Session-start checklist",
    description: "A repeatable startup sequence that restores context before an agent changes code.",
    kind: "session",
    content: `# Session-Start Checklist

## Restore Context

- [ ] Read \`AGENTS.md\`.
- [ ] Read \`memory/product.md\`, \`memory/user-profile.md\`, \`memory/roadmap.md\`, and \`memory/decisions.md\`.
- [ ] Read the current roadmap, issue, or user request.
- [ ] Check repository status and recent commits without reverting existing work.
- [ ] Identify the smallest set of files that owns the requested behavior.

## Current Readiness Priorities

${priorities}

## Before Editing

- [ ] State the intended outcome and important tradeoffs.
- [ ] Confirm assumptions against code and tests.
- [ ] Identify sensitive surfaces: auth, payments, user data, secrets, deployment, and migrations.

## Before Finishing

${verificationCommands(facts).replaceAll("- ", "- [ ] ")}
- [ ] Review the diff for unrelated changes and exposed secrets.
- [ ] Update product memory or the decision log only when durable facts changed.
- [ ] Summarize implementation, verification, and remaining risk.
`,
  };
}

function createIntegrationArtifact(input: GenerateSetupPackInput): SetupArtifact {
  const { facts, checklist } = input;
  const context = checklist.context;

  return {
    id: "integration-checklist",
    path: "memory/integrations.md",
    title: "MCP and API wiring checklist",
    description: "A least-privilege integration plan that names capabilities without collecting credentials.",
    kind: "integration",
    content: `# MCP And API Wiring Checklist

This document records required capabilities and setup status. Never place credentials, access tokens, passwords, or private keys in this file.

## Core Development Access

- [ ] Repository provider: read source, branches, pull requests, and issues with least privilege.
- [ ] File access: restrict tools to the project workspace unless a broader path is explicitly approved.
- [ ] Browser access: use for UI verification and public documentation; avoid authenticated production actions by default.
- [ ] Documentation access: prefer official framework and provider documentation.

## Project-Specific Review

- Framework detected: ${facts.framework.name}
- Authentication detected: ${yesNo(facts.signals.hasAuthDependency || facts.signals.hasAuthRoute)}
- Payments detected: ${yesNo(facts.signals.hasStripeDependency || facts.signals.hasPaymentRoute)}
- User data expected: ${yesNo(context.storesUserData)}
- Observability detected: ${yesNo(facts.signals.hasErrorTrackingDependency)}

${context.hasUserAccounts ? "- [ ] Authentication provider: grant only the user and session operations required by the task." : "- [ ] Authentication provider: not currently required by the selected product context."}
${context.hasPayments ? "- [ ] Payment provider: separate test and production access; require confirmation for refunds, subscriptions, or customer changes." : "- [ ] Payment provider: not currently required by the selected product context."}
${context.storesUserData ? "- [ ] Database provider: use scoped credentials, read-only access for inspection, and explicit approval for migrations or destructive queries." : "- [ ] Database provider: confirm whether persistent user data will be introduced before wiring access."}
- [ ] Observability provider: permit reading errors and traces; keep personally identifiable data out of prompts.

## Secret Handling

- [ ] Store local secrets in ignored environment files.
- [ ] Store deployed secrets in the hosting provider's secret manager.
- [ ] Keep variable names and setup instructions in \`.env.example\`, never real values.
- [ ] Rotate credentials immediately if a secret enters Git history, logs, screenshots, or chat.

## Session Hook Contract

A session-start hook may compile calendar, tracker, repository, and prior-session context only after each source is explicitly connected. Its output should contain:

- status: success | warning | error
- summary: one-line result
- next_actions: concrete follow-ups
- artifacts: source files, issue IDs, or URLs

Stop when a required source is unavailable or permission is broader than the task requires. Never silently continue with invented context.
`,
  };
}

export function generateSetupPack(input: GenerateSetupPackInput): SetupPack {
  const artifacts = [
    createRulesArtifact(input),
    createProductMemoryArtifact(input),
    createDecisionMemoryArtifact(),
    createRoadmapMemoryArtifact(input),
    createUserProfileArtifact(input),
    createSessionArtifact(input),
    createIntegrationArtifact(input),
  ];

  return {
    version: 1,
    projectName: input.projectName,
    summary: `${artifacts.length} evidence-backed workspace files for ${input.projectName}. Confirm every TODO before treating it as product truth.`,
    artifacts,
  };
}
