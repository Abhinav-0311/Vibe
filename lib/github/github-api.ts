export type GitHubErrorCode =
  | "auth_required"
  | "forbidden"
  | "not_found"
  | "rate_limited"
  | "issues_disabled"
  | "archive_too_large"
  | "invalid_branch"
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

// ponytail: per-instance cooldown; use shared rate-limit storage only after hosted users have identities and quotas.
let publicRetryAt = 0;

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
  if (!options.token && publicRetryAt > Date.now()) {
    throw new GitHubApiError(
      "GitHub rate limit reached. Wait until the reset time before retrying.",
      429,
      "rate_limited",
      new Date(publicRetryAt).toISOString(),
    );
  }

  let response: Response;

  try {
    response = await fetch(`https://api.github.com${path}`, {
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
  } catch {
    throw new GitHubApiError(
      "Vibe could not reach GitHub. Check the internet connection and try again.",
      502,
      "github_error",
    );
  }

  if (!response.ok) {
    try {
      await throwGitHubError(response);
    } catch (error) {
      if (!options.token && error instanceof GitHubApiError && error.code === "rate_limited" && error.retryAt) {
        publicRetryAt = new Date(error.retryAt).getTime();
      }

      throw error;
    }
  }
  return response;
}

export function resetPublicGitHubCooldownForTests() {
  publicRetryAt = 0;
}

export function githubErrorPayload(error: unknown) {
  const githubError = error instanceof GitHubApiError || (
    typeof error === "object" &&
    error !== null &&
    (error as { name?: unknown }).name === "GitHubApiError" &&
    typeof (error as { status?: unknown }).status === "number" &&
    typeof (error as { code?: unknown }).code === "string" &&
    typeof (error as { message?: unknown }).message === "string"
  )
    ? error as GitHubApiError
    : null;

  if (githubError) {
    return {
      status: githubError.status,
      body: {
        error: githubError.message,
        code: githubError.code,
        ...(githubError.retryAt ? { retryAt: githubError.retryAt } : {}),
      },
    };
  }

  return {
    status: 500,
    body: { error: "GitHub operation failed. Try again.", code: "github_error" },
  };
}
