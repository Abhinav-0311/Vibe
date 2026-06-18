import { GitHubApiError, githubFetch } from "@/lib/github/github-api";

export type GitHubRepoRef = {
  owner: string;
  repo: string;
};

export function parseGitHubRepoUrl(value: string): GitHubRepoRef {
  let url: URL;

  try {
    url = new URL(value.trim());
  } catch {
    throw new Error("Enter a valid GitHub repository URL.");
  }

  if (url.hostname !== "github.com" && url.hostname !== "www.github.com") {
    throw new Error("Only github.com repository URLs are supported.");
  }

  const [owner, repo, extra] = url.pathname.split("/").filter(Boolean);

  if (!owner || !repo || extra) {
    throw new Error("Use a repository URL like https://github.com/owner/repo.");
  }

  const normalizedRepo = repo.replace(/\.git$/i, "");

  if (!normalizedRepo) {
    throw new Error("Use a repository URL like https://github.com/owner/repo.");
  }

  return {
    owner,
    repo: normalizedRepo,
  };
}

const maxArchiveBytes = 25 * 1024 * 1024;

export async function downloadGitHubRepoZip(
  repoUrl: string,
  options: { token?: string | null; branch?: string } = {},
): Promise<{
  name: string;
  buffer: Buffer;
  branch: string;
  repository: GitHubRepoRef;
}> {
  const repo = parseGitHubRepoUrl(repoUrl);
  const metadataResponse = await githubFetch(`/repos/${repo.owner}/${repo.repo}`, { token: options.token });

  const metadata = (await metadataResponse.json()) as { default_branch?: string; full_name?: string };
  const branch = options.branch?.trim() || metadata.default_branch;

  if (!branch) {
    throw new Error("Could not detect the repository default branch.");
  }

  const archiveResponse = await githubFetch(
    `/repos/${repo.owner}/${repo.repo}/zipball/${encodeURIComponent(branch)}`,
    {
      token: options.token,
      accept: "application/vnd.github+json",
    },
  );
  const contentLength = Number(archiveResponse.headers.get("content-length") ?? 0);
  if (contentLength > maxArchiveBytes) {
    throw new GitHubApiError(
      "This repository archive is larger than Vibe's 25 MB scan limit.",
      413,
      "archive_too_large",
    );
  }

  const buffer = Buffer.from(await archiveResponse.arrayBuffer());
  if (buffer.byteLength > maxArchiveBytes) {
    throw new GitHubApiError(
      "This repository archive is larger than Vibe's 25 MB scan limit.",
      413,
      "archive_too_large",
    );
  }

  return {
    name: metadata.full_name ?? `${repo.owner}/${repo.repo}`,
    buffer,
    branch,
    repository: repo,
  };
}
