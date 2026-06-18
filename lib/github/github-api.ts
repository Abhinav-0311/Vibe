export type GitHubErrorCode =
  | "auth_required"
  | "forbidden"
  | "not_found"
  | "rate_limited"
  | "issues_disabled"
  | "archive_too_large"
  | "validation_failed"
  | "github_error";

export class GitHubApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: GitHubErrorCode,
    public readonly retryAt?: string,
  ) {
    super(message);
    this.name = "GitHubApiError";
  }
}

function readRetryAt(response: Response) {
  const retryAfter = response.headers.get("retry-after");
  if (retryAfter) {
    const seconds = Number(retryAfter);
    const retryDate = Number.isFinite(seconds) ? new Date(Date.now() + seconds * 1000) : new Date(retryAfter);
    if (!Number.isNaN(retryDate.getTime())) return retryDate.toISOString();
  }

  const reset = response.headers.get("x-ratelimit-reset");
  if (reset) return new Date(Number(reset) * 1000).toISOString();
  return undefined;
}

async function throwGitHubError(response: Response): Promise<never> {
  const body = (await response.json().catch(() => null)) as { message?: string } | null;
  const remaining = response.headers.get("x-ratelimit-remaining");
  const isRateLimited =
    (response.status === 403 || response.status === 429) &&
    (remaining === "0" || Boolean(response.headers.get("retry-after")) || /rate limit/i.test(body?.message ?? ""));

  if (isRateLimited) {
    throw new GitHubApiError(
      "GitHub rate limit reached. Wait until the reset time before retrying.",
      429,
      "rate_limited",
      readRetryAt(response),
    );
  }

  if (response.status === 401) {
    throw new GitHubApiError("GitHub connection expired. Reconnect GitHub and try again.", 401, "auth_required");
  }
  if (response.status === 403) {
    throw new GitHubApiError("GitHub denied access to this repository or action.", 403, "forbidden");
  }
  if (response.status === 404) {
    throw new GitHubApiError("GitHub repository or resource was not found.", 404, "not_found");
  }
  if (response.status === 410) {
    throw new GitHubApiError("GitHub Issues are disabled for this repository.", 410, "issues_disabled");
  }
  if (response.status === 422) {
    throw new GitHubApiError(body?.message ?? "GitHub rejected the request data.", 422, "validation_failed");
  }

  throw new GitHubApiError(body?.message ?? "GitHub request failed.", 502, "github_error");
}

export async function githubFetch(
  path: string,
  options: {
    token?: string | null;
    method?: "GET" | "POST";
    body?: unknown;
    accept?: string;
  } = {},
) {
  const response = await fetch(`https://api.github.com${path}`, {
    method: options.method ?? "GET",
    headers: {
      Accept: options.accept ?? "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "Vibe-Launch-Readiness-Auditor",
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
      ...(options.body ? { "Content-Type": "application/json" } : {}),
    },
    ...(options.body ? { body: JSON.stringify(options.body) } : {}),
    redirect: "follow",
    cache: "no-store",
  });

  if (!response.ok) await throwGitHubError(response);
  return response;
}

export function githubErrorPayload(error: unknown) {
  if (error instanceof GitHubApiError) {
    return {
      status: error.status,
      body: {
        error: error.message,
        code: error.code,
        ...(error.retryAt ? { retryAt: error.retryAt } : {}),
      },
    };
  }

  return {
    status: 500,
    body: { error: error instanceof Error ? error.message : "GitHub operation failed.", code: "github_error" },
  };
}
