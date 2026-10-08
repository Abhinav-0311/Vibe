import { afterEach, describe, expect, it, vi } from "vitest";
import { downloadGitHubRepoZip, parseGitHubRepoUrl, resolveGitHubRepoRevision } from "@/lib/github/github-repo";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("parseGitHubRepoUrl", () => {
  it("parses a normal GitHub repository URL", () => {
    expect(parseGitHubRepoUrl("https://github.com/Abhinav-0311/Vibe")).toEqual({
      owner: "Abhinav-0311",
      repo: "Vibe",
    });
  });

  it("normalizes clone-style repository URLs", () => {
    expect(parseGitHubRepoUrl("https://github.com/owner/project.git")).toEqual({
      owner: "owner",
      repo: "project",
    });
  });

  it("rejects non-GitHub URLs", () => {
    expect(() => parseGitHubRepoUrl("https://example.com/owner/project")).toThrow(
      "Only github.com repository URLs are supported.",
    );
  });

  it("rejects nested GitHub paths", () => {
    expect(() => parseGitHubRepoUrl("https://github.com/owner/project/issues")).toThrow(
      "Use a repository URL like https://github.com/owner/repo.",
    );
  });

  it("rejects invalid URLs", () => {
    expect(() => parseGitHubRepoUrl("not-a-url")).toThrow("Enter a valid GitHub repository URL.");
  });
});

describe("downloadGitHubRepoZip", () => {
  it("downloads the resolved commit even if the branch changes before the archive request", async () => {
    const revision = { name: "owner/project", repository: { owner: "owner", repo: "project" }, branch: "main", commitSha: "resolved-commit", isPublic: true };
    const fetchMock = vi.fn(async (url: string) => new Response(url.endsWith("/zipball/resolved-commit") ? "resolved source" : "new branch source"));
    vi.stubGlobal("fetch", fetchMock);
    const archive = await downloadGitHubRepoZip("https://github.com/owner/project", { revision });
    expect(archive.commitSha).toBe("resolved-commit");
    expect(archive.branch).toBe("main");
    expect(archive.buffer.toString()).toBe("resolved source");
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("does not share concurrent archives for different resolved commits on the same branch", async () => {
    const revision = { name: "owner/project", repository: { owner: "owner", repo: "project" }, branch: "main", commitSha: "first-commit", isPublic: true };
    const fetchMock = vi.fn(async (url: string) => new Response(url.endsWith("/first-commit") ? "first source" : "second source"));
    vi.stubGlobal("fetch", fetchMock);
    const [first, second] = await Promise.all([
      downloadGitHubRepoZip("https://github.com/owner/project", { revision }),
      downloadGitHubRepoZip("https://github.com/owner/project", { revision: { ...revision, commitSha: "second-commit" } }),
    ]);
    expect(first.commitSha).toBe("first-commit");
    expect(first.buffer.toString()).toBe("first source");
    expect(second.commitSha).toBe("second-commit");
    expect(second.buffer.toString()).toBe("second source");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("preserves case-sensitive branch metadata for concurrent scans", async () => {
    const revision = { name: "owner/project", repository: { owner: "owner", repo: "project" }, branch: "Main", commitSha: "shared-commit", isPublic: true };
    const fetchMock = vi.fn(async () => new Response("shared source"));
    vi.stubGlobal("fetch", fetchMock);
    const [upper, lower] = await Promise.all([
      downloadGitHubRepoZip("https://github.com/owner/project", { branch: "Main", revision }),
      downloadGitHubRepoZip("https://github.com/owner/project", { branch: "main", revision: { ...revision, branch: "main" } }),
    ]);
    expect(upper.branch).toBe("Main");
    expect(lower.branch).toBe("main");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("shares the same resolved revision regardless of redundant branch options", async () => {
    const revision = { name: "owner/project", repository: { owner: "owner", repo: "project" }, branch: "main", commitSha: "shared-commit", isPublic: true };
    const fetchMock = vi.fn(async () => new Response("shared source"));
    vi.stubGlobal("fetch", fetchMock);
    const [first, second] = await Promise.all([
      downloadGitHubRepoZip("https://github.com/owner/project", { revision }),
      downloadGitHubRepoZip("https://github.com/owner/project", { branch: "main", revision }),
    ]);
    expect(first).toEqual(second);
    expect(first.buffer.toString()).toBe("shared source");
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("cancels a real stalled archive stream cleanly when the body deadline expires", async () => {
    vi.useFakeTimers();
    let streamController!: ReadableStreamDefaultController<Uint8Array>;
    const cancelStream = vi.fn();
    const stream = new ReadableStream<Uint8Array>({
      start(controller) { streamController = controller; },
      cancel: cancelStream,
    });
    const response = new Response(stream);
    const fetchMock = vi.fn().mockResolvedValueOnce(response).mockResolvedValueOnce(new Response(new Uint8Array([80, 75, 3, 4])));
    vi.stubGlobal("fetch", fetchMock);
    const revision = { name: "owner/stalled-stream", repository: { owner: "owner", repo: "stalled-stream" }, branch: "main", commitSha: "test-commit", isPublic: true };
    try {
      const expected = expect(downloadGitHubRepoZip("https://github.com/owner/stalled-stream", {
        revision,
      })).rejects.toMatchObject({ status: 504, code: "request_timeout" });
      await vi.advanceTimersByTimeAsync(15_000);
      await expected;
      expect(cancelStream).toHaveBeenCalledOnce();
      expect(stream.locked).toBe(false);
      expect(vi.getTimerCount()).toBe(0);
      // The failed request must not leave a rejected promise in the download deduplication map.
      const recovered = await downloadGitHubRepoZip("https://github.com/owner/stalled-stream", { revision });
      expect(recovered.buffer).toEqual(Buffer.from([80, 75, 3, 4]));
      expect(fetchMock).toHaveBeenCalledTimes(2);
    } finally {
      if (!cancelStream.mock.calls.length) streamController.close();
    }
  });

  it("shares one anonymous download between concurrent scans of the same repository", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ default_branch: "main", full_name: "owner/project", private: false }), { status: 200 }),
      )
      .mockResolvedValueOnce(new Response(JSON.stringify({ sha: "commit-sha" }), { status: 200 }))
      .mockResolvedValueOnce(new Response(new Uint8Array([80, 75, 3, 4]), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const [first, second] = await Promise.all([
      downloadGitHubRepoZip("https://github.com/owner/project"),
      downloadGitHubRepoZip("https://github.com/owner/project"),
    ]);

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(second).toEqual(first);
    expect(first.commitSha).toBe("commit-sha");
  });

  it("returns an actionable error when GitHub cannot be reached", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("fetch failed")));

    await expect(downloadGitHubRepoZip("https://github.com/owner/project")).rejects.toMatchObject({
      message: "Vibe could not reach GitHub. Check the internet connection and try again.",
      code: "github_error",
      status: 502,
    });
  });

  it("resolves the requested branch and downloads its pinned commit through the authenticated GitHub API", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ default_branch: "main", full_name: "owner/project", private: false }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(new Response(JSON.stringify({ sha: "commit-sha" }), { status: 200 }))
      .mockResolvedValueOnce(new Response(new Uint8Array([80, 75, 3, 4]), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await downloadGitHubRepoZip("https://github.com/owner/project", {
      token: "test-token",
      branch: "release/candidate",
    });

    expect(result.branch).toBe("release/candidate");
    expect(result.repository).toEqual({ owner: "owner", repo: "project" });
    expect(result.commitSha).toBe("commit-sha");
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      "https://api.github.com/repos/owner/project/zipball/commit-sha",
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: "Bearer test-token" }) }),
    );
  });

  it("rejects invalid requested branch names before downloading the archive", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ default_branch: "main", full_name: "owner/project" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    await expect(downloadGitHubRepoZip("https://github.com/owner/project", { branch: "feature bad" })).rejects.toMatchObject({
      code: "invalid_branch",
      status: 400,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("rejects invalid default branch metadata before downloading the archive", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ default_branch: "feature..bad", full_name: "owner/project" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    await expect(downloadGitHubRepoZip("https://github.com/owner/project")).rejects.toMatchObject({
      code: "invalid_branch",
      status: 400,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("rejects archives larger than 25 MB before buffering them", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ default_branch: "main", full_name: "owner/project", private: false }), { status: 200 }),
      )
      .mockResolvedValueOnce(new Response(JSON.stringify({ sha: "commit-sha" }), { status: 200 }))
      .mockResolvedValueOnce(
        new Response(new Uint8Array([1]), {
          status: 200,
          headers: { "Content-Length": String(26 * 1024 * 1024) },
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    await expect(downloadGitHubRepoZip("https://github.com/owner/project")).rejects.toMatchObject({
      code: "archive_too_large",
      status: 413,
    });
  });

  it("preserves the timeout error even if stream cancellation rejects", async () => {
    vi.useFakeTimers();
    const cancel = vi.fn().mockRejectedValue(new Error("private cleanup failure"));
    const stream = new ReadableStream<Uint8Array>({ cancel });
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(new Response(JSON.stringify({ default_branch: "main", full_name: "owner/project", private: false }), { status: 200 }))
        .mockResolvedValueOnce(new Response(JSON.stringify({ sha: "commit-sha" }), { status: 200 }))
        .mockResolvedValueOnce(new Response(stream)),
    );

    const download = downloadGitHubRepoZip("https://github.com/owner/project");
    const expectedTimeout = expect(download).rejects.toMatchObject({ code: "request_timeout", status: 504 });
    await vi.advanceTimersByTimeAsync(15_000);

    await expectedTimeout;
    expect(cancel).toHaveBeenCalledOnce();
    expect(stream.locked).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("cancels an oversized streamed archive without relying on Content-Length", async () => {
    const cancel = vi.fn();
    const stream = new ReadableStream<Uint8Array>({
      start(controller) { controller.enqueue(new Uint8Array(25 * 1024 * 1024 + 1)); },
      cancel,
    });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(stream)));
    await expect(downloadGitHubRepoZip("https://github.com/owner/oversized-stream", {
      revision: { name: "owner/oversized-stream", repository: { owner: "owner", repo: "oversized-stream" }, branch: "main", commitSha: "test-commit", isPublic: true },
    })).rejects.toMatchObject({ status: 413, code: "archive_too_large" });
    expect(cancel).toHaveBeenCalledOnce();
    expect(stream.locked).toBe(false);
  });

  it("combines streamed archive chunks in order and releases the reader", async () => {
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array([80, 75]));
        controller.enqueue(new Uint8Array([3, 4]));
        controller.close();
      },
    });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(stream)));
    const archive = await downloadGitHubRepoZip("https://github.com/owner/chunked-stream", {
      revision: { name: "owner/chunked-stream", repository: { owner: "owner", repo: "chunked-stream" }, branch: "main", commitSha: "test-commit", isPublic: true },
    });
    expect(archive.buffer).toEqual(Buffer.from([80, 75, 3, 4]));
    expect(stream.locked).toBe(false);
  });

  it("resolves an immutable public commit before a cache lookup", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ default_branch: "main", full_name: "owner/project", private: false }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ sha: "a1b2c3" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(resolveGitHubRepoRevision("https://github.com/owner/project")).resolves.toEqual({
      name: "owner/project",
      repository: { owner: "owner", repo: "project" },
      branch: "main",
      commitSha: "a1b2c3",
      isPublic: true,
    });
  });
});
