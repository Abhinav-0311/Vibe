import { afterEach, describe, expect, it } from "vitest";
import { rateLimitRetentionCutoff, scanRetentionCutoff, scanRetentionDays } from "@/lib/data-retention";

const originalRetentionDays = process.env.VIBE_SCAN_RETENTION_DAYS;

afterEach(() => {
  if (originalRetentionDays === undefined) delete process.env.VIBE_SCAN_RETENTION_DAYS;
  else process.env.VIBE_SCAN_RETENTION_DAYS = originalRetentionDays;
});

describe("scan data retention", () => {
  it("defaults saved scans to 30 days and permits a positive configured value", () => {
    delete process.env.VIBE_SCAN_RETENTION_DAYS;
    expect(scanRetentionDays()).toBe(30);
    process.env.VIBE_SCAN_RETENTION_DAYS = "14";
    expect(scanRetentionDays()).toBe(14);
  });

  it("rejects invalid retention values and computes bounded cleanup cutoffs", () => {
    process.env.VIBE_SCAN_RETENTION_DAYS = "0";
    expect(scanRetentionDays()).toBe(30);
    const now = new Date("2026-08-11T00:00:00.000Z");
    expect(scanRetentionCutoff(now).toISOString()).toBe("2026-07-12T00:00:00.000Z");
    expect(rateLimitRetentionCutoff(now).toISOString()).toBe("2026-08-10T00:00:00.000Z");
  });
});
