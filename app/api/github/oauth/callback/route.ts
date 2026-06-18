import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  encryptGitHubToken,
  getGitHubOAuthConfig,
  githubOauthStateCookie,
  githubOauthVerifierCookie,
  githubTokenCookie,
} from "@/lib/github/github-oauth";

export const dynamic = "force-dynamic";

function appRedirect(status: "connected" | "denied" | "failed") {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3005";
  const url = new URL(appUrl);
  url.searchParams.set("github", status);
  return NextResponse.redirect(url);
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  if (params.get("error")) return appRedirect("denied");

  const code = params.get("code");
  const returnedState = params.get("state");
  const cookieStore = await cookies();
  const expectedState = cookieStore.get(githubOauthStateCookie)?.value;
  const verifier = cookieStore.get(githubOauthVerifierCookie)?.value;

  cookieStore.delete(githubOauthStateCookie);
  cookieStore.delete(githubOauthVerifierCookie);

  if (!code || !returnedState || !expectedState || returnedState !== expectedState || !verifier) {
    return appRedirect("failed");
  }

  try {
    const config = getGitHubOAuthConfig();
    const tokenResponse = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        code,
        redirect_uri: config.callbackUrl,
        code_verifier: verifier,
      }),
    });
    const tokenBody = (await tokenResponse.json()) as { access_token?: string; error?: string };
    if (!tokenResponse.ok || !tokenBody.access_token) return appRedirect("failed");

    cookieStore.set(githubTokenCookie, encryptGitHubToken(tokenBody.access_token), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 30 * 24 * 60 * 60,
    });
    return appRedirect("connected");
  } catch {
    return appRedirect("failed");
  }
}
