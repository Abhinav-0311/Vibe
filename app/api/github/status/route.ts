import { NextResponse } from "next/server";
import { githubOAuthConfigured } from "@/lib/github/github-oauth";
import { getGitHubAccessToken } from "@/lib/github/github-session";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    configured: githubOAuthConfigured(),
    connected: Boolean(await getGitHubAccessToken()),
  });
}
