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

export async function downloadGitHubRepoZip(repoUrl: string): Promise<{ name: string; buffer: Buffer }> {
  const repo = parseGitHubRepoUrl(repoUrl);
  const repoApiUrl = `https://api.github.com/repos/${repo.owner}/${repo.repo}`;
  const metadataResponse = await fetch(repoApiUrl, {
    headers: {
      Accept: "application/vnd.github+json",
      "User-Agent": "Vibe-Launch-Readiness-Auditor",
    },
  });

  if (!metadataResponse.ok) {
    throw new Error("Could not read that public GitHub repository.");
  }

  const metadata = (await metadataResponse.json()) as { default_branch?: string; full_name?: string };
  const branch = metadata.default_branch;

  if (!branch) {
    throw new Error("Could not detect the repository default branch.");
  }

  const archiveUrl = `https://codeload.github.com/${repo.owner}/${repo.repo}/zip/refs/heads/${encodeURIComponent(branch)}`;
  const archiveResponse = await fetch(archiveUrl, {
    headers: {
      "User-Agent": "Vibe-Launch-Readiness-Auditor",
    },
  });

  if (!archiveResponse.ok) {
    throw new Error("Could not download the GitHub repository archive.");
  }

  return {
    name: metadata.full_name ?? `${repo.owner}/${repo.repo}`,
    buffer: Buffer.from(await archiveResponse.arrayBuffer()),
  };
}
