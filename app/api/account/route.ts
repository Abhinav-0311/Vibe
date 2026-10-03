import { NextResponse } from "next/server";
import { deleteBetaAccount, getBetaAccountSummary } from "@/lib/beta-account";
import { getBetaUser } from "@/lib/auth";
import { reportServerError } from "@/lib/observability/server";
import { githubTokenCookie, githubOauthStateCookie, githubOauthVerifierCookie } from "@/lib/github/github-oauth";

export const dynamic = "force-dynamic";

export async function GET() {
  const betaUser = await getBetaUser();
  if (!betaUser) return NextResponse.json({ error: "Private beta access is required." }, { status: 401 });

  try {
    return NextResponse.json(await getBetaAccountSummary(betaUser));
  } catch {
    reportServerError("beta_account_read_failed");
    return NextResponse.json({ error: "Account details are temporarily unavailable." }, { status: 503 });
  }
}

export async function DELETE() {
  const betaUser = await getBetaUser();
  if (!betaUser) return NextResponse.json({ error: "Private beta access is required." }, { status: 401 });

  try {
    const deleted = await deleteBetaAccount(betaUser);
    if (!deleted) return NextResponse.json({ error: "Account deletion could not be completed." }, { status: 409 });
    const response = NextResponse.json({ deleted: true });
    for (const name of [githubTokenCookie, githubOauthStateCookie, githubOauthVerifierCookie]) {
      response.cookies.delete(name);
    }
    return response;
  } catch {
    reportServerError("beta_account_delete_failed");
    return NextResponse.json({ error: "Account deletion could not be completed." }, { status: 503 });
  }
}
