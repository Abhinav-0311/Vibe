import { afterEach, describe, expect, it, vi } from "vitest";
import { githubFetch } from "@/lib/github/github-api";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("githubFetch", () => {
  it("maps exhausted primary rate limits and includes the reset time", async () => {
    const reset = Math.floor(Date.now() / 1000) + 60;
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ message: "API rate limit exceeded" }), {
          status: 403,
          headers: {
            "Content-Type": "application/json",
            "X-RateLimit-Remaining": "0",
            "X-RateLimit-Reset": String(reset),
          },
        }),
      ),
    );

    await expect(githubFetch("/repos/owner/project")).rejects.toMatchObject({
      code: "rate_limited",
      status: 429,
      retryAt: new Date(reset * 1000).toISOString(),
    });
  });

  it("maps missing repositories to a useful not-found error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ message: "Not Found" }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );

    await expect(githubFetch("/repos/owner/missing")).rejects.toMatchObject({
      code: "not_found",
      status: 404,
    });
  });
});
