import { NextResponse } from "next/server";
import { getBetaUser } from "@/lib/auth";
import { listFindingFeedback, saveFindingFeedback } from "@/lib/db/finding-feedback";
import { reportServerError } from "@/lib/observability/server";
import { isDatabaseConfigured } from "@/lib/prisma";

export const dynamic = "force-dynamic";
const findingIdPattern = /^[a-z0-9-]{1,80}$/;

export async function GET() {
  const betaUser = await getBetaUser();
  if (!betaUser) return NextResponse.json({ error: "Private beta access is required." }, { status: 401 });
  if (!isDatabaseConfigured()) return NextResponse.json({ databaseConfigured: false, feedback: [] });
  try {
    return NextResponse.json({ databaseConfigured: true, feedback: await listFindingFeedback(betaUser.id) });
  } catch {
    reportServerError("finding_feedback_read_failed");
    return NextResponse.json({ databaseConfigured: true, feedback: [], error: "database_error" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const betaUser = await getBetaUser();
  if (!betaUser) return NextResponse.json({ error: "Private beta access is required." }, { status: 401 });
  if (!isDatabaseConfigured()) return NextResponse.json({ error: "Database is not configured." }, { status: 503 });
  try {
    const body = (await request.json()) as { findingId?: unknown; helpful?: unknown };
    if (typeof body.findingId !== "string" || !findingIdPattern.test(body.findingId) || typeof body.helpful !== "boolean") {
      return NextResponse.json({ error: "Invalid finding feedback." }, { status: 400 });
    }
    const feedback = await saveFindingFeedback(betaUser.id, { findingId: body.findingId, helpful: body.helpful });
    return NextResponse.json({ feedback });
  } catch {
    reportServerError("finding_feedback_write_failed");
    return NextResponse.json({ error: "Unable to save feedback." }, { status: 500 });
  }
}
