import { afterEach, describe, expect, it, vi } from "vitest";
import { githubErrorPayload, githubFetch, resetPublicGitHubCooldownForTests } from "@/lib/github/github-api";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
  resetPublicGitHubCooldownForTests();
});

describe("githubFetch", () => {
  it("resumes anonymous requests after the cooldown expires", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-08T12:00:00Z"));
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ message: "secondary rate limit" }), { status: 429, headers: { "Retry-After": "2" } }))
      .mockResolvedValueOnce(new Response("recovered", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(githubFetch("/repos/owner/project")).rejects.toMatchObject({ status: 429, retryAt: "2026-10-08T12:00:02.000Z" });
    await expect(githubFetch("/repos/owner/project")).rejects.toMatchObject({ status: 429 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(2_001);
    expect((await githubFetch("/repos/owner/project")).status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("bounds a stalled GitHub request using its real abort signal", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", vi.fn((_url, options: RequestInit) => new Promise<Response>((_resolve, reject) => {
      options.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true });
    })));
    const expected = expect(githubFetch("/repos/owner/project")).rejects.toMatchObject({ status: 504, code: "request_timeout" });
    await vi.advanceTimersByTimeAsync(12_000);
    await expected;
    expect(vi.getTimerCount()).toBe(0);
  });

  it("does not block an authenticated connection with another request's anonymous cooldown", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response("{}", { status: 429, headers: { "Retry-After": "60" } }))
      .mockResolvedValueOnce(new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(githubFetch("/repos/owner/project")).rejects.toMatchObject({ status: 429 });
    expect((await githubFetch("/repos/owner/project", { token: "test-token" })).status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

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

  it("returns a bounded timeout error when GitHub does not respond", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new DOMException("Aborted", "AbortError")));

    await expect(githubFetch("/repos/owner/project")).rejects.toMatchObject({
      code: "request_timeout",
      status: 504,
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

  it("gives unknown GitHub failures an actionable safe message", () => {
    expect(githubErrorPayload(new Error("upstream failure"))).toEqual({
      status: 500,
      body: {
        error: "Vibe could not complete the GitHub request. Retry shortly; if it continues, confirm the repository is public or connect GitHub for private access.",
        code: "github_error",
      },
    });
  });
});
