import { describe, expect, it } from "vitest";
import { consumeRateLimitWindow } from "@/lib/scan-rate-limit";

describe("public scan rate limit", () => {
  it("blocks the fifth request in a one-minute window and resets afterwards", () => {
    const windows = new Map<string, { count: number; windowStart: number }>();
    const startedAt = 1_000_000;

    for (let count = 0; count < 4; count += 1) {
      expect(consumeRateLimitWindow(windows, "upload:visitor", startedAt + count).allowed).toBe(true);
    }

    const blocked = consumeRateLimitWindow(windows, "upload:visitor", startedAt + 5);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBe(60);
    expect(consumeRateLimitWindow(windows, "upload:visitor", startedAt + 60_000).allowed).toBe(true);
  });
});
