import { afterEach, describe, expect, it } from "vitest";
import { buildBetaAccountSummary, startOfUtcDay } from "@/lib/beta-account";

const originalLimit = process.env.VIBE_BETA_DAILY_SCAN_LIMIT;
const originalRetention = process.env.VIBE_SCAN_RETENTION_DAYS;

afterEach(() => {
  if (originalLimit === undefined) delete process.env.VIBE_BETA_DAILY_SCAN_LIMIT;
  else process.env.VIBE_BETA_DAILY_SCAN_LIMIT = originalLimit;
  if (originalRetention === undefined) delete process.env.VIBE_SCAN_RETENTION_DAYS;
  else process.env.VIBE_SCAN_RETENTION_DAYS = originalRetention;
});

describe("beta account summary", () => {
  it("reports daily quota and retention without exposing stored scan content", () => {
    process.env.VIBE_BETA_DAILY_SCAN_LIMIT = "8";
    process.env.VIBE_SCAN_RETENTION_DAYS = "14";

    expect(buildBetaAccountSummary("tester@example.com", 3)).toEqual({
      email: "tester@example.com",
      dailyScanLimit: 8,
      scansUsedToday: 3,
      scansRemainingToday: 5,
      scanRetentionDays: 14,
    });
  });

  it("bounds invalid usage and uses a UTC daily window", () => {
    expect(buildBetaAccountSummary("tester@example.com", -2).scansUsedToday).toBe(0);
    expect(startOfUtcDay(new Date("2026-09-15T23:59:00.000-07:00")).toISOString()).toBe("2026-09-16T00:00:00.000Z");
  });
});
