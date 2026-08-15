import { NextResponse } from "next/server";
import { githubOAuthConfigured } from "@/lib/github/github-oauth";
import { getGitHubAccessToken } from "@/lib/github/github-session";
import { getBetaUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await getBetaUser())) return NextResponse.json({ error: "Private beta access is required." }, { status: 401 });
  return NextResponse.json({
    configured: githubOAuthConfigured(),
    connected: Boolean(await getGitHubAccessToken()),
  });
}
