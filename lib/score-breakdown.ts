import type { AuditFinding, Severity } from "@/lib/mock-audit";

export type ScoreBreakdownItem = {
  category: string;
  score: number;
  findingCount: number;
  status: "clear" | "watch" | "weak" | "blocked";
  topFinding?: {
    title: string;
    severity: Severity;
  };
};

const defaultCategories = ["Security", "Reliability", "Launch Basics", "AI Workspace", "UI/UX"];

const severityPenalty: Record<Severity, number> = {
  critical: 45,
  high: 30,
  medium: 18,
  low: 8,
};

const severityRank: Record<Severity, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

function scoreStatus(score: number): ScoreBreakdownItem["status"] {
  if (score >= 90) return "clear";
  if (score >= 70) return "watch";
  if (score >= 45) return "weak";
  return "blocked";
}

export function buildScoreBreakdown(findings: AuditFinding[]): ScoreBreakdownItem[] {
  const categories = Array.from(new Set([...defaultCategories, ...findings.map((finding) => finding.category)]));

  return categories.map((category) => {
    const categoryFindings = findings.filter((finding) => finding.category === category);
    const penalty = categoryFindings.reduce((total, finding) => total + severityPenalty[finding.severity], 0);
    const score = Math.max(0, 100 - penalty);
    const topFinding = categoryFindings
      .slice()
      .sort((left, right) => severityRank[left.severity] - severityRank[right.severity])[0];

    return {
      category,
      score,
      findingCount: categoryFindings.length,
      status: scoreStatus(score),
      topFinding: topFinding ? { title: topFinding.title, severity: topFinding.severity } : undefined,
    };
  });
}
