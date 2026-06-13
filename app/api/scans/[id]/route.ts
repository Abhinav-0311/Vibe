import { NextResponse } from "next/server";
import { getSavedScanRecord } from "@/lib/db/scan-records";
import { isDatabaseConfigured } from "@/lib/prisma";
import type { SavedScanDetailApiResponse } from "@/lib/scan-api";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json(
      {
        databaseConfigured: false,
        record: null,
        error: "database_error",
      } satisfies SavedScanDetailApiResponse,
      { status: 503 },
    );
  }

  try {
    const { id } = await params;
    const record = await getSavedScanRecord(id);

    if (!record) {
      return NextResponse.json(
        {
          databaseConfigured: true,
          record: null,
          error: "not_found",
        } satisfies SavedScanDetailApiResponse,
        { status: 404 },
      );
    }

    return NextResponse.json({
      databaseConfigured: true,
      record,
    } satisfies SavedScanDetailApiResponse);
  } catch (error) {
    console.error("Failed to load saved scan record", error);

    return NextResponse.json(
      {
        databaseConfigured: true,
        record: null,
        error: "database_error",
      } satisfies SavedScanDetailApiResponse,
      { status: 503 },
    );
  }
}
