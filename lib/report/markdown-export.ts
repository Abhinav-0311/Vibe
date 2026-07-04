import type { ChecklistResult } from "@/lib/checklist/types";
import type { ActionPriority } from "@/lib/mock-audit";
import type { ScannerFacts } from "@/lib/scanner/types";
import type { GeneratedReport } from "./types";

const actionPriorityOrder: ActionPriority[] = ["required", "recommended", "optional"];
const actionPriorityLabel: Record<ActionPriority, string> = {
  required: "Required",
  recommended: "Recommended",
  optional: "Optional",
};

type FormatMarkdownReportInput = {
  projectName: string;
  facts: ScannerFacts;
  checklist: ChecklistResult;
  report: GeneratedReport;
};

function formatContext(checklist: ChecklistResult) {
  const context = checklist.context;

  return [
    `- App type: ${context.appType}`,
    `- Stage: ${context.stage}`,
    `- Payments: ${context.hasPayments ? "yes" : "no"}`,
    `- User accounts: ${context.hasUserAccounts ? "yes" : "no"}`,
    `- Stores user data: ${context.storesUserData ? "yes" : "no"}`,
  ].join("\n");
}

function formatScannerFacts(facts: ScannerFacts) {
  return [
    `- Framework: ${facts.framework.name} (${facts.framework.confidence} confidence)`,
    `- Package manager: ${facts.packageManager}`,
    `- Dependencies detected: ${facts.dependencies.length}`,
    `- Tests detected: ${facts.signals.hasTests ? "yes" : "no"}`,
    `- AI rules detected: ${facts.signals.hasAiRules ? "yes" : "no"}`,
    `- Environment example detected: ${facts.signals.hasEnvExample ? "yes" : "no"}`,
  ].join("\n");
}

function formatTopRisks(report: GeneratedReport) {
  if (report.topRisks.length === 0) {
    return "No top risks were found for this scan context.";
  }

  return report.topRisks
    .map(
      (risk, index) => `${index + 1}. ${risk.title}
   - Severity: ${risk.severity}
   - Category: ${risk.category}
   - Impact: ${risk.impact}
   - Suggested fix: ${risk.suggestedFix}`,
    )
    .join("\n");
}

function formatNextActions(report: GeneratedReport) {
  return report.nextActions.map((action, index) => `${index + 1}. ${action}`).join("\n");
}

function formatFindings(checklist: ChecklistResult) {
  if (checklist.findings.length === 0) {
    return "No findings were produced by the current checklist.";
  }

  let index = 0;

  return actionPriorityOrder
    .map((priority) => {
      const findings = checklist.findings.filter((finding) => (finding.actionPriority ?? "recommended") === priority);
      if (findings.length === 0) return "";

      const formattedFindings = findings
        .map((finding) => {
          index += 1;

          return `### Finding ${index}: ${finding.title}

- Severity: ${finding.severity}
- Action priority: ${finding.actionPriority ?? "recommended"}
- Category: ${finding.category}
- Status: ${finding.status}
${finding.status === "ignored" && finding.statusReason ? `- Not relevant reason: ${finding.statusReason}\n` : ""}- Evidence: ${finding.evidence}
- Why this rank: ${finding.severityReason ?? "Severity is based on the selected audit context and detected project evidence."}
- Impact: ${finding.impact}
- Fix: ${finding.fix}

### Learn the mistake

- What it means: ${finding.learning?.explanation ?? "This finding points to a readiness gap detected from repository evidence."}
- Why builders miss it: ${finding.learning?.commonMistake ?? "Builders often focus on the happy-path demo and miss production support systems."}
- Good fix: ${finding.learning?.goodFix ?? "Fix the specific evidence, verify the behavior, and re-run Vibe."}

### Verification

${(finding.verification ?? ["Re-run Vibe and confirm the finding is resolved."]).map((item) => `- ${item}`).join("\n")}

### Implementation prompt

${finding.prompt}`;
        })
        .join("\n\n");

      return `## ${actionPriorityLabel[priority]} Findings\n\n${formattedFindings}`;
    })
    .filter(Boolean)
    .join("\n\n");
}

export function formatMarkdownReport({
  projectName,
  facts,
  checklist,
  report,
}: FormatMarkdownReportInput) {
  return `# ${projectName} Readiness Report

Generated: ${report.generatedAt}

## Readiness

${report.readinessLabel}

Score: ${checklist.score}/100

${report.executiveSummary}

${report.interpretation}

## Scan Context

${formatContext(checklist)}

## Scanner Facts

${formatScannerFacts(facts)}

## Top Risks

${formatTopRisks(report)}

## Next Actions

${formatNextActions(report)}

## Prompt Queue

${report.promptQueueSummary}

${formatFindings(checklist)}
`;
}
