import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { githubTokenCookie } from "@/lib/github/github-oauth";
import { getBetaUser } from "@/lib/auth";

export async function POST() {
  if (!(await getBetaUser())) return NextResponse.json({ error: "Private beta access is required." }, { status: 401 });
  const cookieStore = await cookies();
  cookieStore.delete(githubTokenCookie);
  return NextResponse.json({ connected: false });
}
