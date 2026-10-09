import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { listFindingFeedback, saveFindingFeedback } from "@/lib/db/finding-feedback";
import { reportServerError } from "@/lib/observability/server";
import { isDatabaseConfigured } from "@/lib/prisma";

export const dynamic = "force-dynamic";
const findingIdPattern = /^[a-z0-9-]{1,80}$/;
const projectKeyLimit = 1_000;

export async function GET(request: Request) {
  const authenticatedUser = await getAuthenticatedUser();
  if (!authenticatedUser) return NextResponse.json({ error: "Sign in with Google to continue." }, { status: 401 });
  const projectKey = new URL(request.url).searchParams.get("projectKey");
  if (!projectKey || projectKey.length > projectKeyLimit) return NextResponse.json({ error: "Invalid project feedback scope." }, { status: 400 });
  if (!isDatabaseConfigured()) return NextResponse.json({ databaseConfigured: false, feedback: [] });
  try {
    return NextResponse.json({ databaseConfigured: true, feedback: await listFindingFeedback(authenticatedUser.id, projectKey) });
  } catch {
    reportServerError("finding_feedback_read_failed");
    return NextResponse.json({ databaseConfigured: true, feedback: [], error: "database_error" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const authenticatedUser = await getAuthenticatedUser();
  if (!authenticatedUser) return NextResponse.json({ error: "Sign in with Google to continue." }, { status: 401 });
  if (!isDatabaseConfigured()) return NextResponse.json({ error: "Database is not configured." }, { status: 503 });
  try {
    const body = (await request.json()) as { projectKey?: unknown; findingId?: unknown; helpful?: unknown };
    if (typeof body.projectKey !== "string" || body.projectKey.length === 0 || body.projectKey.length > projectKeyLimit || typeof body.findingId !== "string" || !findingIdPattern.test(body.findingId) || typeof body.helpful !== "boolean") {
      return NextResponse.json({ error: "Invalid finding feedback." }, { status: 400 });
    }
    const feedback = await saveFindingFeedback(authenticatedUser.id, { projectKey: body.projectKey, findingId: body.findingId, helpful: body.helpful });
    return NextResponse.json({ feedback });
  } catch {
    reportServerError("finding_feedback_write_failed");
    return NextResponse.json({ error: "Unable to save feedback." }, { status: 500 });
  }
}
