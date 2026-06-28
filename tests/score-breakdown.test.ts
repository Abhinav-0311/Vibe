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
    });
  });

  it("scores categories from findings without changing the overall readiness score", () => {
    const breakdown = buildScoreBreakdown([
      { ...auditReport.findings[0], category: "UI/UX", severity: "high" },
      { ...auditReport.findings[1], category: "UI/UX", severity: "medium" },
      { ...auditReport.findings[2], category: "Security", severity: "critical" },
    ]);

    expect(breakdown.find((item) => item.category === "UI/UX")).toMatchObject({
      score: 52,
      findingCount: 2,
    });
    expect(breakdown.find((item) => item.category === "Security")).toMatchObject({
      score: 55,
      findingCount: 1,
    });
  });
});
