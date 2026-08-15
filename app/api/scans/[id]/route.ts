import { NextResponse } from "next/server";
import { getSavedScanRecord } from "@/lib/db/scan-records";
import { isDatabaseConfigured } from "@/lib/prisma";
import type { SavedScanDetailApiResponse } from "@/lib/scan-api";
import { getBetaUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const betaUser = await getBetaUser();
  if (!betaUser) return NextResponse.json({ error: "Private beta access is required." }, { status: 401 });
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
    const record = await getSavedScanRecord(id, betaUser.id);

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
