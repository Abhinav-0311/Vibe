import { getDailyScanLimit } from "@/lib/auth";
import { scanRetentionDays } from "@/lib/data-retention";
import { getPrisma } from "@/lib/prisma";

export type AccountSummary = {
  email: string;
  dailyScanLimit: number;
  scansUsedToday: number;
  scansRemainingToday: number;
  scanRetentionDays: number;
};

export function startOfUtcDay(now = new Date()) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

export function buildAccountSummary(email: string, used: number) {
  const dailyScanLimit = getDailyScanLimit();
  const scansUsedToday = Math.max(0, used);

  return {
    email,
    dailyScanLimit,
    scansUsedToday,
    scansRemainingToday: Math.max(0, dailyScanLimit - scansUsedToday),
    scanRetentionDays: scanRetentionDays(),
  } satisfies AccountSummary;
}

export async function getAccountSummary(user: { id: string; email: string }) {
  const prisma = getPrisma();
  if (!prisma) return buildAccountSummary(user.email, 0);

  const usage = await prisma.scanQuotaUsage.findUnique({
    where: { userId_windowStart: { userId: user.id, windowStart: startOfUtcDay() } },
    select: { count: true },
  });

  return buildAccountSummary(user.email, usage?.count ?? 0);
}

export async function deleteAccount(user: { id: string; email: string }) {
  const prisma = getPrisma();
  if (!prisma) return false;

  const [, deleted] = await prisma.$transaction([
    // Remove historical enrollment data too; it no longer controls access.
    prisma.betaInvite.deleteMany({ where: { email: user.email } }),
    prisma.user.deleteMany({ where: { id: user.id } }),
  ]);
  return deleted.count === 1;
}
