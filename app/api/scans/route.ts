import { NextResponse } from "next/server";
import { listReadinessTrend, listSavedScanRecords } from "@/lib/db/scan-records";
import { isDatabaseConfigured } from "@/lib/prisma";
import { reportServerError } from "@/lib/observability/server";
import { getBetaUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const betaUser = await getBetaUser();
  if (!betaUser) return NextResponse.json({ error: "Private beta access is required." }, { status: 401 });

  if (!isDatabaseConfigured()) {
    return NextResponse.json({
      databaseConfigured: false,
      records: [],
    });
  }

  try {
    const [records, trend] = await Promise.all([
      listSavedScanRecords(betaUser.id),
      listReadinessTrend(betaUser.id),
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
