import { describe, expect, it } from "vitest";
import { parseGitHubRepoUrl } from "@/lib/github/github-repo";

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
