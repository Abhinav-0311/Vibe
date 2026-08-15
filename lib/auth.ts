import { PrismaAdapter } from "@next-auth/prisma-adapter";
import type { NextAuthOptions } from "next-auth";
import { getServerSession } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { getPrisma } from "@/lib/prisma";

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

  const windowStartedAt = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const used = await prisma.scanRecord.count({ where: { userId, createdAt: { gte: windowStartedAt } } });
  const limit = getBetaDailyScanLimit();

  return {
    allowed: used < limit,
    retryAfterSeconds: 60 * 60,
    remaining: Math.max(0, limit - used),
  };
}
