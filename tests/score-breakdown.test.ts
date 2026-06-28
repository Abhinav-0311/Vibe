import { describe, expect, it } from "vitest";
import { buildScoreBreakdown } from "@/lib/score-breakdown";
import { auditReport } from "@/lib/mock-audit";

describe("score breakdown", () => {
  it("always includes UI/UX even when no UI findings are present", () => {
    const breakdown = buildScoreBreakdown([]);

    expect(breakdown.find((item) => item.category === "UI/UX")).toEqual({
      category: "UI/UX",
      score: 100,
      findingCount: 0,
      status: "clear",
      topFinding: undefined,
    });
  });

  it("scores categories and keeps the most severe finding visible", () => {
    const breakdown = buildScoreBreakdown([
      { ...auditReport.findings[0], category: "UI/UX", severity: "high" },
      { ...auditReport.findings[1], category: "UI/UX", severity: "medium" },
      { ...auditReport.findings[2], category: "Security", severity: "critical" },
    ]);

    expect(breakdown.find((item) => item.category === "UI/UX")).toMatchObject({
      score: 52,
      findingCount: 2,
      status: "weak",
      topFinding: {
        title: auditReport.findings[0].title,
        severity: "high",
      },
    });
    expect(breakdown.find((item) => item.category === "Security")).toMatchObject({
      score: 55,
      findingCount: 1,
      status: "weak",
      topFinding: {
        title: auditReport.findings[2].title,
        severity: "critical",
      },
    });
  });
});
