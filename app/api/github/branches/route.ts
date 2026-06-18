import { NextResponse } from "next/server";
import { githubErrorPayload, githubFetch } from "@/lib/github/github-api";
import { getGitHubAccessToken } from "@/lib/github/github-session";

export const dynamic = "force-dynamic";

const repositoryPattern = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;

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
