import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { listGuidanceFeedback, saveGuidanceFeedback } from "@/lib/db/guidance-feedback";
import { nextJsGuidanceCatalogVersion } from "@/lib/nextjs-guidance";
import { reportServerError } from "@/lib/observability/server";
import { isDatabaseConfigured } from "@/lib/prisma";

export const dynamic = "force-dynamic";
const guidanceIdPattern = /^(?:nextjs|vite)-[a-z0-9-]{1,80}$/;

export async function GET() {
  const authenticatedUser = await getAuthenticatedUser();
  if (!authenticatedUser) return NextResponse.json({ error: "Sign in with Google to continue." }, { status: 401 });
  if (!isDatabaseConfigured()) return NextResponse.json({ databaseConfigured: false, feedback: [] });
  try {
    return NextResponse.json({ databaseConfigured: true, feedback: await listGuidanceFeedback(authenticatedUser.id) });
  } catch {
    reportServerError("guidance_feedback_read_failed");
    return NextResponse.json({ databaseConfigured: true, feedback: [], error: "database_error" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const authenticatedUser = await getAuthenticatedUser();
  if (!authenticatedUser) return NextResponse.json({ error: "Sign in with Google to continue." }, { status: 401 });
  if (!isDatabaseConfigured()) return NextResponse.json({ error: "Database is not configured." }, { status: 503 });
  try {
    const body = (await request.json()) as { guidanceId?: unknown; catalogVersion?: unknown; helpful?: unknown };
    if (typeof body.guidanceId !== "string" || !guidanceIdPattern.test(body.guidanceId) || body.catalogVersion !== nextJsGuidanceCatalogVersion || typeof body.helpful !== "boolean") {
      return NextResponse.json({ error: "Invalid guidance feedback." }, { status: 400 });
    }
    const feedback = await saveGuidanceFeedback(authenticatedUser.id, { guidanceId: body.guidanceId, catalogVersion: body.catalogVersion, helpful: body.helpful });
    return NextResponse.json({ feedback });
  } catch {
    reportServerError("guidance_feedback_write_failed");
    return NextResponse.json({ error: "Unable to save feedback." }, { status: 500 });
  }
}
