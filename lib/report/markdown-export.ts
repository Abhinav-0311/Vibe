import type { ChecklistResult } from "@/lib/checklist/types";
import type { ScannerFacts } from "@/lib/scanner/types";
import type { GeneratedReport } from "./types";

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

  return checklist.findings
    .map(
      (finding, index) => `## Finding ${index + 1}: ${finding.title}

- Severity: ${finding.severity}
- Category: ${finding.category}
- Status: ${finding.status}
- Evidence: ${finding.evidence}
- Why this rank: ${finding.severityReason ?? "Severity is based on the selected audit context and detected project evidence."}
- Impact: ${finding.impact}
- Fix: ${finding.fix}

### Verification

${(finding.verification ?? ["Re-run Vibe and confirm the finding is resolved."]).map((item) => `- ${item}`).join("\n")}

### Implementation prompt

${finding.prompt}`,
    )
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
