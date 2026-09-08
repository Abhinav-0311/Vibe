import { PrismaAdapter } from "@next-auth/prisma-adapter";
import type { NextAuthOptions } from "next-auth";
import { getServerSession } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { Prisma } from "@prisma/client";
import { getPrisma } from "@/lib/prisma";
import { quotaUsageRetentionCutoff } from "@/lib/data-retention";

const dailyScanLimit = Number.parseInt(process.env.VIBE_BETA_DAILY_SCAN_LIMIT ?? "20", 10);

function normalizedEmail(email: string) {
  return email.trim().toLowerCase();
}

export function googleAuthConfigured() {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.NEXTAUTH_SECRET);
}

export function getBetaDailyScanLimit() {
  return Number.isFinite(dailyScanLimit) && dailyScanLimit > 0 ? dailyScanLimit : 20;
}

export const authOptions: NextAuthOptions = {
  adapter: getPrisma() ? PrismaAdapter(getPrisma()!) : undefined,
  providers: googleAuthConfigured()
    ? [
        GoogleProvider({
          clientId: process.env.GOOGLE_CLIENT_ID!,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
          authorization: { params: { prompt: "select_account" } },
        }),
      ]
    : [],
  session: { strategy: "database" },
  callbacks: {
    async signIn({ user }) {
      const prisma = getPrisma();
      if (!prisma || !user.email) return false;

      const invite = await prisma.betaInvite.findUnique({
        where: { email: normalizedEmail(user.email) },
        select: { active: true },
      });

      return Boolean(invite?.active);
    },
    async session({ session, user }) {
      if (session.user) session.user.id = user.id;
      return session;
    },
  },
  pages: { signIn: "/" },
};

export type BetaUser = { id: string; email: string };

export async function getBetaUser(): Promise<BetaUser | null> {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  const email = session?.user?.email;
  const prisma = getPrisma();
  if (!userId || !email || !prisma) return null;

  const invite = await prisma.betaInvite.findUnique({
    where: { email: normalizedEmail(email) },
    select: { active: true },
  });

  return invite?.active ? { id: userId, email: normalizedEmail(email) } : null;
}

export async function enforceBetaScanQuota(userId: string) {
  const prisma = getPrisma();
  if (!prisma) return { allowed: false, retryAfterSeconds: 60 };

  const limit = getBetaDailyScanLimit();
  const now = new Date();
  const windowStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const nextWindowStart = new Date(windowStart.getTime() + 24 * 60 * 60 * 1000);

  try {
    await prisma.scanQuotaUsage.deleteMany({ where: { updatedAt: { lt: quotaUsageRetentionCutoff(now) } } });
    // Count the attempt before a scan begins. This stays correct for repeated,
    // deduplicated, or failed scans and is atomic across concurrent requests.
    const rows = await prisma.$queryRaw<Array<{ count: number }>>(Prisma.sql`
      INSERT INTO "ScanQuotaUsage" ("userId", "windowStart", "count", "createdAt", "updatedAt")
      VALUES (${userId}, ${windowStart}, 1, ${now}, ${now})
      ON CONFLICT ("userId", "windowStart") DO UPDATE SET
        "count" = "ScanQuotaUsage"."count" + 1,
        "updatedAt" = ${now}
      WHERE "ScanQuotaUsage"."count" < ${limit}
      RETURNING "count"
    `);

    const used = rows[0]?.count;
    const retryAfterSeconds = Math.max(1, Math.ceil((nextWindowStart.getTime() - now.getTime()) / 1000));

    return {
      allowed: used !== undefined,
      retryAfterSeconds,
      remaining: used === undefined ? 0 : Math.max(0, limit - used),
    };
  } catch {
    // Fail closed: a missing or unavailable durable counter must not make the
    // hosted scan endpoints unlimited.
    return { allowed: false, retryAfterSeconds: 60, remaining: 0 };
  }
}
