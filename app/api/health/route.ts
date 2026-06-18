import { NextResponse } from "next/server";
import { checkHealth } from "@/lib/health/health-check";
import { getPrisma, isDatabaseConfigured } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  let prisma: ReturnType<typeof getPrisma> = null;
  try {
    prisma = getPrisma();
  } catch {
    // The response below remains intentionally generic so configuration values never leak.
  }
  const result = await checkHealth({
    databaseConfigured: isDatabaseConfigured() && Boolean(prisma),
    checkDatabase: async () => {
      if (!prisma) throw new Error("Database is not configured.");
      await prisma.$queryRaw`SELECT 1`;
    },
  });

  return NextResponse.json(
    {
      ...result,
      service: "vibe",
      timestamp: new Date().toISOString(),
    },
    { status: result.status === "ok" ? 200 : 503 },
  );
}
