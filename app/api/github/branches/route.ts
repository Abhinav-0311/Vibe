import { NextResponse } from "next/server";
import { githubErrorPayload, githubFetch } from "@/lib/github/github-api";
import { getGitHubAccessToken } from "@/lib/github/github-session";
import { isValidGitHubBranch, repositoryPattern } from "@/lib/github/github-refs";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const fullName = new URL(request.url).searchParams.get("repository") ?? "";
  if (!repositoryPattern.test(fullName)) {
    return NextResponse.json({ error: "Select a valid GitHub repository." }, { status: 400 });
  }

  const token = await getGitHubAccessToken();
  if (!token) return NextResponse.json({ error: "Connect GitHub to list branches." }, { status: 401 });

  try {
    const response = await githubFetch(`/repos/${fullName}/branches?per_page=100`, { token });
    const branches = (await response.json()) as Array<{ name: string; protected: boolean }>;
    return NextResponse.json({ branches });
  } catch (error) {
    const payload = githubErrorPayload(error);
    return NextResponse.json(payload.body, { status: payload.status });
  }
}

export async function POST(request: Request) {
  const token = await getGitHubAccessToken();
  if (!token) return NextResponse.json({ error: "Connect GitHub before creating a fix branch." }, { status: 401 });

  try {
    const body = (await request.json()) as {
      repository?: string;
      baseBranch?: string;
      branchName?: string;
    };
    if (
      !body.repository ||
      !repositoryPattern.test(body.repository) ||
      !body.baseBranch ||
      !isValidGitHubBranch(body.baseBranch) ||
      !body.branchName ||
      !isValidGitHubBranch(body.branchName) ||
      body.baseBranch === body.branchName
    ) {
      return NextResponse.json({ error: "Repository, base branch, and a different valid fix branch are required." }, { status: 400 });
    }

    const baseResponse = await githubFetch(
      `/repos/${body.repository}/git/ref/heads/${encodeURIComponent(body.baseBranch)}`,
      { token },
    );
    const baseRef = (await baseResponse.json()) as { object?: { sha?: string } };
    if (!baseRef.object?.sha) {
      return NextResponse.json({ error: "GitHub did not return the base branch commit." }, { status: 502 });
    }

    const branchResponse = await githubFetch(`/repos/${body.repository}/git/refs`, {
      token,
      method: "POST",
      body: {
        ref: `refs/heads/${body.branchName}`,
        sha: baseRef.object.sha,
      },
    });
    const branch = (await branchResponse.json()) as { ref?: string; object?: { sha?: string } };
    return NextResponse.json({
      branchName: body.branchName,
      ref: branch.ref,
      sha: branch.object?.sha,
      url: `https://github.com/${body.repository}/tree/${body.branchName.split("/").map(encodeURIComponent).join("/")}`,
    });
  } catch (error) {
    const payload = githubErrorPayload(error);
    return NextResponse.json(payload.body, { status: payload.status });
  }
}
