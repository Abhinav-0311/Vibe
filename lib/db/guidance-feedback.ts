import { randomUUID } from "node:crypto";
import { getPrisma, isDatabaseConfigured } from "@/lib/prisma";

export type GuidanceFeedbackRecord = {
  guidanceId: string;
  catalogVersion: string;
  helpful: boolean;
};

export async function listGuidanceFeedback(userId: string): Promise<GuidanceFeedbackRecord[]> {
  const prisma = getPrisma();
  if (!prisma || !isDatabaseConfigured()) return [];

  return prisma.$queryRaw<GuidanceFeedbackRecord[]>`
    SELECT "guidanceId", "catalogVersion", "helpful"
    FROM "GuidanceFeedback"
    WHERE "userId" = ${userId}
  `;
}

export async function saveGuidanceFeedback(userId: string, feedback: GuidanceFeedbackRecord) {
  const prisma = getPrisma();
  if (!prisma || !isDatabaseConfigured()) return null;

  const [saved] = await prisma.$queryRaw<GuidanceFeedbackRecord[]>`
    INSERT INTO "GuidanceFeedback" ("id", "userId", "guidanceId", "catalogVersion", "helpful", "createdAt", "updatedAt")
    VALUES (${randomUUID()}, ${userId}, ${feedback.guidanceId}, ${feedback.catalogVersion}, ${feedback.helpful}, NOW(), NOW())
    ON CONFLICT ("userId", "guidanceId", "catalogVersion")
    DO UPDATE SET "helpful" = EXCLUDED."helpful", "updatedAt" = NOW()
    RETURNING "guidanceId", "catalogVersion", "helpful"
  `;

  return saved ?? null;
}
