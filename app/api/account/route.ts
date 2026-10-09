import { NextResponse } from "next/server";
import { deleteAccount, getAccountSummary } from "@/lib/account";
import { getAuthenticatedUser } from "@/lib/auth";
import { reportServerError } from "@/lib/observability/server";
import { githubTokenCookie, githubOauthStateCookie, githubOauthVerifierCookie } from "@/lib/github/github-oauth";

export const dynamic = "force-dynamic";

export async function GET() {
  const authenticatedUser = await getAuthenticatedUser();
  if (!authenticatedUser) return NextResponse.json({ error: "Sign in with Google to continue." }, { status: 401 });

  try {
    return NextResponse.json(await getAccountSummary(authenticatedUser));
  } catch {
    reportServerError("account_read_failed");
    return NextResponse.json({ error: "Account details are temporarily unavailable." }, { status: 503 });
  }
}

export async function DELETE() {
  const authenticatedUser = await getAuthenticatedUser();
  if (!authenticatedUser) return NextResponse.json({ error: "Sign in with Google to continue." }, { status: 401 });

  try {
    const deleted = await deleteAccount(authenticatedUser);
    if (!deleted) return NextResponse.json({ error: "Account deletion could not be completed." }, { status: 409 });
    const response = NextResponse.json({ deleted: true });
    for (const name of [githubTokenCookie, githubOauthStateCookie, githubOauthVerifierCookie]) {
      response.cookies.delete(name);
    }
    return response;
  } catch {
    reportServerError("account_delete_failed");
    return NextResponse.json({ error: "Account deletion could not be completed." }, { status: 503 });
  }
}
