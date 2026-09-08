import { describe, expect, it } from "vitest";
import { apiError } from "@/lib/api-error";

describe("apiError", () => {
  it("returns a safe machine-readable error with retry metadata", async () => {
    const response = apiError("Too many scans.", "rate_limited", 429, { retryAfterSeconds: 60 });

    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("60");
    await expect(response.json()).resolves.toEqual({ error: "Too many scans.", code: "rate_limited" });
  });
});
