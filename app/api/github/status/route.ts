import { NextResponse } from "next/server";
import { githubOAuthConfigured } from "@/lib/github/github-oauth";
import { getGitHubAccessToken } from "@/lib/github/github-session";
import { getAuthenticatedUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await getAuthenticatedUser())) return NextResponse.json({ error: "Sign in with Google to continue." }, { status: 401 });
  return NextResponse.json({
    configured: githubOAuthConfigured(),
    connected: Boolean(await getGitHubAccessToken()),
  });
}
