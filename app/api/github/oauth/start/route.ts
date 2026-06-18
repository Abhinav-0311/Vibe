import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  createOAuthChallenge,
  getGitHubOAuthConfig,
  githubOauthStateCookie,
  githubOauthVerifierCookie,
} from "@/lib/github/github-oauth";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const config = getGitHubOAuthConfig();
    const challenge = createOAuthChallenge();
    const cookieStore = await cookies();
    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax" as const,
      path: "/",
      maxAge: 10 * 60,
    };

    cookieStore.set(githubOauthStateCookie, challenge.state, cookieOptions);
    cookieStore.set(githubOauthVerifierCookie, challenge.verifier, cookieOptions);

    const authorizeUrl = new URL("https://github.com/login/oauth/authorize");
    authorizeUrl.searchParams.set("client_id", config.clientId);
    authorizeUrl.searchParams.set("redirect_uri", config.callbackUrl);
    authorizeUrl.searchParams.set("scope", "repo");
    authorizeUrl.searchParams.set("state", challenge.state);
    authorizeUrl.searchParams.set("code_challenge", challenge.challenge);
    authorizeUrl.searchParams.set("code_challenge_method", "S256");

    return NextResponse.redirect(authorizeUrl);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "GitHub OAuth could not start." },
      { status: 503 },
    );
  }
}
