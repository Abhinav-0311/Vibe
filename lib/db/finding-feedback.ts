import { randomUUID } from "node:crypto";
import { getPrisma, isDatabaseConfigured } from "@/lib/prisma";

export type FindingFeedbackRecord = {
  findingId: string;
  helpful: boolean;
};

export async function listFindingFeedback(userId: string): Promise<FindingFeedbackRecord[]> {
  const prisma = getPrisma();
  if (!prisma || !isDatabaseConfigured()) return [];

  return prisma.$queryRaw<FindingFeedbackRecord[]>`
    SELECT "findingId", "helpful"
    FROM "FindingFeedback"
    WHERE "userId" = ${userId}
  `;
}

export async function saveFindingFeedback(userId: string, feedback: FindingFeedbackRecord) {
  const prisma = getPrisma();
  if (!prisma || !isDatabaseConfigured()) return null;

  const [saved] = await prisma.$queryRaw<FindingFeedbackRecord[]>`
    INSERT INTO "FindingFeedback" ("id", "userId", "findingId", "helpful", "createdAt", "updatedAt")
    VALUES (${randomUUID()}, ${userId}, ${feedback.findingId}, ${feedback.helpful}, NOW(), NOW())
    ON CONFLICT ("userId", "findingId")
    DO UPDATE SET "helpful" = EXCLUDED."helpful", "updatedAt" = NOW()
    RETURNING "findingId", "helpful"
  `;

  return saved ?? null;
}
