import { NextResponse } from "next/server";
import { listSavedScanRecords } from "@/lib/db/scan-records";
import { isDatabaseConfigured } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({
      databaseConfigured: false,
      records: [],
    });
  }

  try {
    const records = await listSavedScanRecords();

    return NextResponse.json({
      databaseConfigured: true,
      records,
    });
  } catch (error) {
    console.error("Failed to list saved scan records", error);

    return NextResponse.json({
      databaseConfigured: true,
      records: [],
      error: "database_error",
    });
  }
}
