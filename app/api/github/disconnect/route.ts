import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { githubTokenCookie } from "@/lib/github/github-oauth";
import { getAuthenticatedUser } from "@/lib/auth";

export async function POST() {
  if (!(await getAuthenticatedUser())) return NextResponse.json({ error: "Sign in with Google to continue." }, { status: 401 });
  const cookieStore = await cookies();
  cookieStore.delete(githubTokenCookie);
  return NextResponse.json({ connected: false });
}
