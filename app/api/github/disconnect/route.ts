import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { githubTokenCookie } from "@/lib/github/github-oauth";

export async function POST() {
  const cookieStore = await cookies();
  cookieStore.delete(githubTokenCookie);
  return NextResponse.json({ connected: false });
}
