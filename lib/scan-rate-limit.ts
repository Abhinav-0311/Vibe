import { createHmac, randomBytes } from "node:crypto";
import { Prisma } from "@prisma/client";
import { getPrisma } from "@/lib/prisma";
import { rateLimitRetentionCutoff } from "@/lib/data-retention";

const windowMs = 60_000;
const maxRequestsPerWindow = 4;
const fallbackSecret = randomBytes(32).toString("hex");
const fallbackWindows = new Map<string, { count: number; windowStart: number }>();

export type RateLimitResult = {
  allowed: boolean;
  retryAfterSeconds: number;
};

function clientAddress(request: Request) {
  return request.headers.get("x-vercel-forwarded-for") ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}

function requestKey(request: Request, bucket: string) {
  const secret = process.env.VIBE_RATE_LIMIT_SECRET ?? fallbackSecret;
  return createHmac("sha256", secret).update(`${bucket}:${clientAddress(request)}`).digest("hex");
}

export function consumeRateLimitWindow(
  windows: Map<string, { count: number; windowStart: number }>,
  key: string,
  now = Date.now(),
) {
  const existing = windows.get(key);
  const current = !existing || now - existing.windowStart >= windowMs
    ? { count: 1, windowStart: now }
    : { count: existing.count + 1, windowStart: existing.windowStart };
  windows.set(key, current);

  return {
    allowed: current.count <= maxRequestsPerWindow,
    retryAfterSeconds: Math.max(1, Math.ceil((current.windowStart + windowMs - now) / 1000)),
  };
}

async function consumeDatabaseRateLimit(key: string, now: Date): Promise<RateLimitResult | null> {
  let prisma: ReturnType<typeof getPrisma>;

  try {
    prisma = getPrisma();
  } catch {
    return null;
  }

  if (!prisma) return null;

  try {
    await prisma.scanRateLimit.deleteMany({ where: { updatedAt: { lt: rateLimitRetentionCutoff(now) } } });
    const windowStart = new Date(now.getTime() - windowMs);
    const rows = await prisma.$queryRaw<Array<{ count: number; windowStart: Date }>>(Prisma.sql`
      INSERT INTO "ScanRateLimit" ("key", "windowStart", "count", "updatedAt")
      VALUES (${key}, ${now}, 1, ${now})
      ON CONFLICT ("key") DO UPDATE SET
        "count" = CASE WHEN "ScanRateLimit"."windowStart" <= ${windowStart} THEN 1 ELSE "ScanRateLimit"."count" + 1 END,
        "windowStart" = CASE WHEN "ScanRateLimit"."windowStart" <= ${windowStart} THEN ${now} ELSE "ScanRateLimit"."windowStart" END,
        "updatedAt" = ${now}
      RETURNING "count", "windowStart"
    `);
    const row = rows[0];

    if (!row) return null;

    return {
      allowed: row.count <= maxRequestsPerWindow,
      retryAfterSeconds: Math.max(1, Math.ceil((row.windowStart.getTime() + windowMs - now.getTime()) / 1000)),
    };
  } catch {
    return null;
  }
}

export async function enforcePublicScanRateLimit(request: Request, bucket: "upload" | "github") {
  const key = requestKey(request, bucket);
  const durableResult = await consumeDatabaseRateLimit(key, new Date());

  // ponytail: process-memory fallback when persistence is unavailable; set DATABASE_URL and VIBE_RATE_LIMIT_SECRET for shared enforcement.
  return durableResult ?? consumeRateLimitWindow(fallbackWindows, key);
}
