import { NextResponse } from "next/server";
import { githubErrorPayload, githubFetch } from "@/lib/github/github-api";
import { isValidGitHubBranch, repositoryPattern } from "@/lib/github/github-refs";
import { getGitHubAccessToken } from "@/lib/github/github-session";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const token = await getGitHubAccessToken();
  if (!token) return NextResponse.json({ error: "Connect GitHub before creating a draft pull request." }, { status: 401 });

  try {
    const body = (await request.json()) as {
      repository?: string;
      baseBranch?: string;
      headBranch?: string;
      title?: string;
      body?: string;
    };
    if (
      !body.repository ||
      !repositoryPattern.test(body.repository) ||
      !body.baseBranch ||
      !isValidGitHubBranch(body.baseBranch) ||
      !body.headBranch ||
      !isValidGitHubBranch(body.headBranch) ||
      body.baseBranch === body.headBranch ||
      !body.title?.trim()
    ) {
      return NextResponse.json({ error: "Repository, distinct base and head branches, and a title are required." }, { status: 400 });
    }

    const response = await githubFetch(`/repos/${body.repository}/pulls`, {
      token,
      method: "POST",
      body: {
        title: body.title.trim().slice(0, 256),
        body: (body.body ?? "").slice(0, 60_000),
        base: body.baseBranch,
        head: body.headBranch,
        draft: true,
      },
    });
    const pullRequest = (await response.json()) as { number?: number; html_url?: string };
    return NextResponse.json({ number: pullRequest.number, url: pullRequest.html_url });
  } catch (error) {
    const payload = githubErrorPayload(error);
    return NextResponse.json(payload.body, { status: payload.status });
  }
}
