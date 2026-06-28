import type { AuditFinding, Severity } from "@/lib/mock-audit";
import type { ScannerFacts } from "@/lib/scanner/types";
import type { FixPlan, FixPlanItem } from "@/lib/fix-assistant/types";

const severityRank: Record<Severity, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

function slug(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "project";
}

function verificationCommands(facts?: ScannerFacts) {
  if (!facts) return ["Run the project's relevant tests and production build."];
  const prefix = facts.packageManager === "unknown" ? "npm" : facts.packageManager;
  const commands: string[] = [];
  if (facts.scripts.test) commands.push(`${prefix} run test`);
  if (facts.scripts.lint) commands.push(`${prefix} run lint`);
  if (facts.scripts.build) commands.push(`${prefix} run build`);
  return commands.length > 0 ? commands : ["Run the project's relevant tests and production build."];
}

function orderedItems(findings: AuditFinding[]): FixPlanItem[] {
  return findings
    .filter((finding) => finding.status !== "ignored")
    .slice()
    .sort((left, right) => severityRank[left.severity] - severityRank[right.severity])
    .map((finding, index) => ({
      id: finding.id,
      order: index + 1,
      title: finding.title,
      category: finding.category,
      severity: finding.severity,
      evidence: finding.evidence,
      severityReason: finding.severityReason,
      learning: finding.learning,
      fix: finding.fix,
      verification: finding.verification,
      prompt: finding.prompt,
    }));
}

function formatWorkItems(items: FixPlanItem[]) {
  if (items.length === 0) return "No open or planned findings are currently queued.";

  return items
    .map(
      (item) => `## ${item.order}. ${item.title}

- [ ] Confirm the evidence is still present: ${item.evidence}
- [ ] Confirm the rank is still appropriate: ${item.severityReason ?? "Review severity against the current launch context."}
- [ ] Implement: ${item.fix}
- [ ] Add or update tests for the changed behavior.
- [ ] Keep unrelated behavior unchanged.

### Learning note

- What it means: ${item.learning?.explanation ?? "This finding points to a readiness gap detected from repository evidence."}
- Why builders miss it: ${item.learning?.commonMistake ?? "Builders often focus on the happy-path demo and miss production support systems."}
- Good fix: ${item.learning?.goodFix ?? "Fix the specific evidence, verify the behavior, and re-run Vibe."}

### Verification

${(item.verification ?? ["Re-run Vibe and confirm the finding is resolved."]).map((step) => `- [ ] ${step}`).join("\n")}

### Coding-agent prompt

${item.prompt}`,
    )
    .join("\n\n");
}

export function generateFixPlan({
  projectName,
  findings,
  facts,
}: {
  projectName: string;
  findings: AuditFinding[];
  facts?: ScannerFacts;
}): FixPlan {
  const items = orderedItems(findings);
  const branchName = `vibe/readiness-${slug(projectName)}`;
  const commands = verificationCommands(facts);
  const verification = commands.map((command) => `- [ ] \`${command}\``).join("\n");
  const pullRequestTitle = `Resolve Vibe readiness findings for ${projectName}`;
  const pullRequestBody = `## Summary

Addresses ${items.length} finding${items.length === 1 ? "" : "s"} from the latest Vibe launch-readiness scan.

## Findings

${items.length > 0 ? items.map((item) => `- [ ] ${item.title} (${item.severity})`).join("\n") : "- No queued findings"}

## Verification

${verification}
- [ ] Re-ran Vibe and reviewed resolved, remaining, and newly introduced findings.

## Safety

- No unrelated refactors.
- No secret values added to source, logs, or documentation.
- This pull request does not claim security certification.`;

  const markdown = `# ${projectName} Implementation Plan

Generated from triaged Vibe findings. This plan does not modify repository code.

## Delivery

- Suggested branch: \`${branchName}\`
- Pull request title: ${pullRequestTitle}
- Queued findings: ${items.length}

## Guardrails

- Work in severity order unless a dependency requires a different sequence.
- Reconfirm evidence before editing because the repository may have changed since the scan.
- Keep every change scoped to one finding or a clearly shared prerequisite.
- Never weaken type checking, linting, tests, authentication, or secret handling to make verification pass.
- Stop and ask when the requested fix requires a product, security, billing, or migration decision.

${formatWorkItems(items)}

## Final Verification

${verification}
- [ ] Review the diff for unrelated changes and exposed secrets.
- [ ] Re-run Vibe against the fixed branch.
- [ ] Confirm critical and high findings are resolved without new findings.
`;

  return {
    projectName,
    branchName,
    pullRequestTitle,
    pullRequestBody,
    markdown,
    items,
  };
}
