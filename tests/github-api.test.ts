import { afterEach, describe, expect, it, vi } from "vitest";
import { githubErrorPayload, githubFetch, resetPublicGitHubCooldownForTests } from "@/lib/github/github-api";

afterEach(() => {
  vi.unstubAllGlobals();
  resetPublicGitHubCooldownForTests();
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

  it("does not retry anonymous requests before GitHub's reset time", async () => {
    const reset = Math.floor(Date.now() / 1000) + 60;
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ message: "API rate limit exceeded" }), {
        status: 403,
        headers: {
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset": String(reset),
        },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(githubFetch("/repos/owner/project")).rejects.toMatchObject({ code: "rate_limited" });
    await expect(githubFetch("/repos/owner/project")).rejects.toMatchObject({ code: "rate_limited" });

    expect(fetchMock).toHaveBeenCalledTimes(1);
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

  it("preserves known GitHub validation errors across module boundaries", () => {
    const payload = githubErrorPayload({
      name: "GitHubApiError",
      message: "Enter a valid GitHub repository URL.",
      status: 400,
      code: "validation_failed",
    });

    expect(payload).toEqual({
      status: 400,
      body: { error: "Enter a valid GitHub repository URL.", code: "validation_failed" },
    });
  });
});
