import { afterEach, describe, expect, it, vi } from "vitest";
import { downloadGitHubRepoZip, parseGitHubRepoUrl } from "@/lib/github/github-repo";

afterEach(() => {
  vi.unstubAllGlobals();
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
  it("returns an actionable error when GitHub cannot be reached", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("fetch failed")));

    await expect(downloadGitHubRepoZip("https://github.com/owner/project")).rejects.toMatchObject({
      message: "Vibe could not reach GitHub. Check the internet connection and try again.",
      code: "github_error",
      status: 502,
    });
  });

  it("downloads the requested branch through the authenticated GitHub API", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ default_branch: "main", full_name: "owner/project" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(new Response(new Uint8Array([80, 75, 3, 4]), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await downloadGitHubRepoZip("https://github.com/owner/project", {
      token: "test-token",
      branch: "release/candidate",
    });

    expect(result.branch).toBe("release/candidate");
    expect(result.repository).toEqual({ owner: "owner", repo: "project" });
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "https://api.github.com/repos/owner/project/zipball/release%2Fcandidate",
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
        new Response(JSON.stringify({ default_branch: "main", full_name: "owner/project" }), { status: 200 }),
      )
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
});
