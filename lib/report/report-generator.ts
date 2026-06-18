import type { ChecklistResult } from "@/lib/checklist/types";
import type { AuditFinding, Severity } from "@/lib/mock-audit";
import type { ScannerFacts } from "@/lib/scanner/types";
import type { GeneratedReport, GeneratedReportRisk } from "./types";

type GenerateReportInput = {
  facts: ScannerFacts;
  checklist: ChecklistResult;
  scannedAt: string;
};

const severityRank: Record<Severity, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

function formatStage(stage: string) {
  return stage
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function getReadinessLabel(checklist: ChecklistResult) {
  const hasCritical = checklist.findings.some((finding) => finding.severity === "critical");

  if (checklist.findings.length === 0) {
    return `${formatStage(checklist.context.stage)} ready`;
  }

  if (hasCritical) {
    return "Launch blocked";
  }

  if (checklist.score >= 80) {
    return "Mostly ready";
  }

  if (checklist.score >= 60) {
    return "Needs focused production work";
  }

  return "Not launch-ready";
}

function getExecutiveSummary(facts: ScannerFacts, checklist: ChecklistResult) {
  const stage = checklist.context.stage;
  const appType = checklist.context.appType;
  const base = `Vibe scanned this ${appType} as a ${stage} project and scored it ${checklist.score}/100.`;

  if (checklist.findings.length === 0) {
    return `${base} The required launch-readiness signals for this context are present, including tests, AI operating rules, analytics planning, observability planning, and environment documentation.`;
  }

  const criticalCount = checklist.findings.filter((finding) => finding.severity === "critical").length;
  const highCount = checklist.findings.filter((finding) => finding.severity === "high").length;
  const missingAreas = checklist.findings
    .slice()
    .sort((a, b) => severityRank[a.severity] - severityRank[b.severity])
    .slice(0, 3)
    .map((finding) => finding.category.toLowerCase())
    .join(", ");

  return `${base} It found ${checklist.findings.length} production-readiness gap${checklist.findings.length === 1 ? "" : "s"}${criticalCount ? `, including ${criticalCount} critical blocker${criticalCount === 1 ? "" : "s"}` : ""}${highCount ? ` and ${highCount} high-priority issue${highCount === 1 ? "" : "s"}` : ""}. The first areas to address are ${missingAreas}.`;
}

function getInterpretation(facts: ScannerFacts, checklist: ChecklistResult) {
  if (checklist.findings.length === 0) {
    return "The scan is clean for the selected context. This does not prove the product is production-safe forever; it means the current repository has the minimum durable systems expected for this stage.";
  }

  if (checklist.context.stage === "prototype") {
    return "The project can continue moving as a prototype, but the listed gaps should be handled before real users, payments, or sensitive data depend on it.";
  }

  return "The project should not be treated as launch-ready until the high-severity and critical items are resolved and the scan is run again.";
}

function toReportRisk(finding: AuditFinding): GeneratedReportRisk {
  return {
    title: finding.title,
    severity: finding.severity,
    category: finding.category,
    impact: finding.impact,
    suggestedFix: finding.fix,
  };
}

function getTopRisks(checklist: ChecklistResult) {
  return checklist.findings
    .slice()
    .sort((a, b) => severityRank[a.severity] - severityRank[b.severity])
    .slice(0, 3)
    .map(toReportRisk);
}

function getNextActions(checklist: ChecklistResult) {
  if (checklist.findings.length === 0) {
    return [
      "Keep the rules file, tests, analytics plan, observability plan, and environment documentation updated as the product changes.",
      "Re-run the scan after adding authentication, payments, user data storage, or deployment changes.",
      "Switch the context to launch prep before onboarding real users.",
    ];
  }

  return checklist.findings
    .slice()
    .sort((a, b) => severityRank[a.severity] - severityRank[b.severity])
    .slice(0, 4)
    .map((finding) => `${finding.fix} Then re-run the scan to confirm the evidence is detected.`);
}

function getPromptQueueSummary(checklist: ChecklistResult) {
  if (checklist.findings.length === 0) {
    return "No implementation prompts are queued because the selected readiness checks passed.";
  }

  const criticalCount = checklist.findings.filter((finding) => finding.severity === "critical").length;
  const highCount = checklist.findings.filter((finding) => finding.severity === "high").length;

  return `${checklist.findings.length} implementation prompt${checklist.findings.length === 1 ? "" : "s"} queued for the coding agent: ${criticalCount} critical, ${highCount} high, and ${checklist.findings.length - criticalCount - highCount} medium.`;
}

export function generateReport({ facts, checklist, scannedAt }: GenerateReportInput): GeneratedReport {
  return {
    generatedAt: scannedAt,
    readinessLabel: getReadinessLabel(checklist),
    executiveSummary: getExecutiveSummary(facts, checklist),
    interpretation: getInterpretation(facts, checklist),
    topRisks: getTopRisks(checklist),
    nextActions: getNextActions(checklist),
    promptQueueSummary: getPromptQueueSummary(checklist),
    generation: { mode: "deterministic" },
  };
}
