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
const archiveReadTimeoutMs = 15_000;
type GitHubArchive = {
  name: string;
  buffer: Buffer;
  branch: string;
  repository: GitHubRepoRef;
  commitSha: string;
  isPublic: boolean;
};

export type GitHubRepoRevision = {
  name: string;
  repository: GitHubRepoRef;
  branch: string;
  commitSha: string;
  isPublic: boolean;
};

// Deduplicate only concurrent archive downloads within one server instance.
const publicDownloads = new Map<string, Promise<GitHubArchive>>();

async function readArchiveBuffer(response: Response) {
  if (!response.body) return Buffer.alloc(0);
  const reader = response.body.getReader();
  let timeout: ReturnType<typeof setTimeout> | undefined;

  async function read() {
    const chunks: Buffer[] = [];
    let bytes = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) return Buffer.concat(chunks, bytes);
      bytes += value.byteLength;
      if (bytes > maxArchiveBytes) {
        throw new GitHubApiError("This repository archive is larger than Vibe's 25 MB scan limit.", 413, "archive_too_large");
      }
      chunks.push(Buffer.from(value));
    }
  }

  try {
    return await Promise.race([
      read(),
      new Promise<never>((_, reject) => {
        timeout = setTimeout(() => {
          reject(new GitHubApiError("GitHub archive download timed out. Try again.", 504, "request_timeout"));
        }, archiveReadTimeoutMs);
      }),
    ]);
  } catch (error) {
    // Cancel through the reader that owns the lock; cleanup must not mask the scan error.
    void reader.cancel().catch(() => undefined);
    throw error;
  } finally {
    if (timeout) clearTimeout(timeout);
    reader.releaseLock();
  }
}

export async function downloadGitHubRepoZip(
  repoUrl: string,
  options: { token?: string | null; branch?: string; revision?: GitHubRepoRevision } = {},
): Promise<GitHubArchive> {
  const repo = parseGitHubRepoUrl(repoUrl);

  if (options.token) return downloadGitHubRepoZipFromRepo(repo, options);

  const key = JSON.stringify([
    `${repo.owner}/${repo.repo}`.toLowerCase(),
    options.revision?.branch ?? options.branch?.trim() ?? "",
    options.revision?.commitSha ?? null,
  ]);
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
  options: { token?: string | null; branch?: string; revision?: GitHubRepoRevision },
): Promise<GitHubArchive> {
  const revision = options.revision ?? await resolveGitHubRepoRevisionFromRepo(repo, options);

  const archiveResponse = await githubFetch(
    `/repos/${repo.owner}/${repo.repo}/zipball/${encodeURIComponent(revision.commitSha)}`,
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

  const buffer = await readArchiveBuffer(archiveResponse);

  return { ...revision, buffer };
}

export async function resolveGitHubRepoRevision(
  repoUrl: string,
  options: { token?: string | null; branch?: string } = {},
): Promise<GitHubRepoRevision> {
  return resolveGitHubRepoRevisionFromRepo(parseGitHubRepoUrl(repoUrl), options);
}

async function resolveGitHubRepoRevisionFromRepo(
  repo: GitHubRepoRef,
  options: { token?: string | null; branch?: string },
): Promise<GitHubRepoRevision> {
  const metadataResponse = await githubFetch(`/repos/${repo.owner}/${repo.repo}`, { token: options.token });

  const metadata = (await metadataResponse.json()) as { default_branch?: string; full_name?: string; private?: boolean };
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

  const commitResponse = await githubFetch(`/repos/${repo.owner}/${repo.repo}/commits/${encodeURIComponent(branch)}`, { token: options.token });
  const commit = (await commitResponse.json()) as { sha?: string };

  if (!commit.sha) throw new Error("Could not resolve the selected GitHub commit.");

  return {
    name: metadata.full_name ?? `${repo.owner}/${repo.repo}`,
    branch,
    repository: repo,
    commitSha: commit.sha,
    isPublic: metadata.private === false,
  };
}
