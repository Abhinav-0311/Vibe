import { GitHubApiError, githubFetch } from "@/lib/github/github-api";
import { isValidGitHubBranch } from "@/lib/github/github-refs";

export type GitHubRepoRef = {
  owner: string;
  repo: string;
};

export function parseGitHubRepoUrl(value: string): GitHubRepoRef {
  let url: URL;

  try {
    url = new URL(value.trim());
  } catch {
    throw new GitHubApiError("Enter a valid GitHub repository URL.", 400, "validation_failed");
  }

  if (url.hostname !== "github.com" && url.hostname !== "www.github.com") {
    throw new GitHubApiError("Only github.com repository URLs are supported.", 400, "validation_failed");
  }

  const [owner, repo, extra] = url.pathname.split("/").filter(Boolean);

  if (!owner || !repo || extra) {
    throw new GitHubApiError("Use a repository URL like https://github.com/owner/repo.", 400, "validation_failed");
  }

  const normalizedRepo = repo.replace(/\.git$/i, "");

  if (!normalizedRepo) {
    throw new GitHubApiError("Use a repository URL like https://github.com/owner/repo.", 400, "validation_failed");
  }

  return {
    owner,
    repo: normalizedRepo,
  };
}

const maxArchiveBytes = 25 * 1024 * 1024;
type GitHubArchive = {
  name: string;
  buffer: Buffer;
  branch: string;
  repository: GitHubRepoRef;
};

// ponytail: dedupes only concurrent requests within one server instance; add durable caching after tenant ownership exists.
const publicDownloads = new Map<string, Promise<GitHubArchive>>();

export async function downloadGitHubRepoZip(
  repoUrl: string,
  options: { token?: string | null; branch?: string } = {},
): Promise<GitHubArchive> {
  const repo = parseGitHubRepoUrl(repoUrl);

  if (options.token) return downloadGitHubRepoZipFromRepo(repo, options);

  const key = `${repo.owner}/${repo.repo}:${options.branch?.trim() ?? ""}`.toLowerCase();
  const existing = publicDownloads.get(key);
  if (existing) return existing;

  const download = downloadGitHubRepoZipFromRepo(repo, options);
  publicDownloads.set(key, download);

  try {
    return await download;
  } finally {
    publicDownloads.delete(key);
  }
}

async function downloadGitHubRepoZipFromRepo(
  repo: GitHubRepoRef,
  options: { token?: string | null; branch?: string },
): Promise<GitHubArchive> {
  const metadataResponse = await githubFetch(`/repos/${repo.owner}/${repo.repo}`, { token: options.token });

  const metadata = (await metadataResponse.json()) as { default_branch?: string; full_name?: string };
  const branch = options.branch?.trim() || metadata.default_branch;

  if (!branch) {
    throw new Error("Could not detect the repository default branch.");
  }

  if (!isValidGitHubBranch(branch)) {
    throw new GitHubApiError(
      "Enter a valid GitHub branch name.",
      400,
      "invalid_branch",
    );
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
