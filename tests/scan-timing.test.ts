import { describe, expect, it } from "vitest";
import { formatScanProcessingTime } from "@/lib/scan-timing";

describe("formatScanProcessingTime", () => {
  it("does not display a completed scan as zero seconds", () => {
    expect(formatScanProcessingTime(0)).toBe("under 0.1s");
    expect(formatScanProcessingTime(99)).toBe("under 0.1s");
  });

  it("uses a compact rounded duration once it is measurable", () => {
    expect(formatScanProcessingTime(100)).toBe("0.1s");
    expect(formatScanProcessingTime(1_245)).toBe("1.2s");
  });
});
