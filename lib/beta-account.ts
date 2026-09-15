import { getBetaDailyScanLimit } from "@/lib/auth";
import { scanRetentionDays } from "@/lib/data-retention";
import { getPrisma } from "@/lib/prisma";

export type BetaAccountSummary = {
  email: string;
  dailyScanLimit: number;
  scansUsedToday: number;
  scansRemainingToday: number;
  scanRetentionDays: number;
};

export function startOfUtcDay(now = new Date()) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

export function buildBetaAccountSummary(email: string, used: number) {
  const dailyScanLimit = getBetaDailyScanLimit();
  const scansUsedToday = Math.max(0, used);

  return {
    email,
    dailyScanLimit,
    scansUsedToday,
    scansRemainingToday: Math.max(0, dailyScanLimit - scansUsedToday),
    scanRetentionDays: scanRetentionDays(),
  } satisfies BetaAccountSummary;
}

export async function getBetaAccountSummary(user: { id: string; email: string }) {
  const prisma = getPrisma();
  if (!prisma) return buildBetaAccountSummary(user.email, 0);

  const usage = await prisma.scanQuotaUsage.findUnique({
    where: { userId_windowStart: { userId: user.id, windowStart: startOfUtcDay() } },
    select: { count: true },
  });

  return buildBetaAccountSummary(user.email, usage?.count ?? 0);
}

export async function deleteBetaAccount(user: { id: string; email: string }) {
  const prisma = getPrisma();
  if (!prisma) return false;

  const [, deleted] = await prisma.$transaction([
    // Deleting the invite prevents the same Google account from silently
    // recreating a beta account after the user has chosen to leave Vibe.
    prisma.betaInvite.deleteMany({ where: { email: user.email } }),
    prisma.user.deleteMany({ where: { id: user.id } }),
  ]);
  return deleted.count === 1;
}
