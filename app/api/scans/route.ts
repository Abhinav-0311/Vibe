import { NextResponse } from "next/server";
import { listReadinessTrend, listSavedScanRecords } from "@/lib/db/scan-records";
import { isDatabaseConfigured } from "@/lib/prisma";
import { reportServerError } from "@/lib/observability/server";
import { getAuthenticatedUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const authenticatedUser = await getAuthenticatedUser();
  if (!authenticatedUser) return NextResponse.json({ error: "Sign in with Google to continue." }, { status: 401 });

  if (!isDatabaseConfigured()) {
    return NextResponse.json({
      databaseConfigured: false,
      records: [],
    });
  }

  try {
    const [records, trend] = await Promise.all([
      listSavedScanRecords(authenticatedUser.id),
      listReadinessTrend(authenticatedUser.id),
    ]);

    return NextResponse.json({
      databaseConfigured: true,
      records,
      trend,
    });
  } catch {
    reportServerError("saved_scan_read_failed");

    return NextResponse.json({
      databaseConfigured: true,
      records: [],
      error: "database_error",
    });
  }
}
