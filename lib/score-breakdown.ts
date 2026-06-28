import type { AuditFinding, Severity } from "@/lib/mock-audit";

export type ScoreBreakdownItem = {
  category: string;
  score: number;
  findingCount: number;
};

const defaultCategories = ["Security", "Reliability", "Launch Basics", "AI Workspace", "UI/UX"];

const severityPenalty: Record<Severity, number> = {
  critical: 45,
  high: 30,
  medium: 18,
  low: 8,
};

export function buildScoreBreakdown(findings: AuditFinding[]): ScoreBreakdownItem[] {
  const categories = Array.from(new Set([...defaultCategories, ...findings.map((finding) => finding.category)]));

  return categories.map((category) => {
    const categoryFindings = findings.filter((finding) => finding.category === category);
    const penalty = categoryFindings.reduce((total, finding) => total + severityPenalty[finding.severity], 0);

    return {
      category,
      score: Math.max(0, 100 - penalty),
      findingCount: categoryFindings.length,
    };
  });
}
