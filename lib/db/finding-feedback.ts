import { randomUUID } from "node:crypto";
import { getPrisma, isDatabaseConfigured } from "@/lib/prisma";

export type FindingFeedbackRecord = {
  projectKey: string;
  findingId: string;
  helpful: boolean;
};

export async function listFindingFeedback(userId: string, projectKey: string): Promise<FindingFeedbackRecord[]> {
  const prisma = getPrisma();
  if (!prisma || !isDatabaseConfigured()) return [];

  return prisma.$queryRaw<FindingFeedbackRecord[]>`
    SELECT "projectKey", "findingId", "helpful"
    FROM "FindingFeedback"
    WHERE "userId" = ${userId} AND "projectKey" = ${projectKey}
  `;
}

export async function saveFindingFeedback(userId: string, feedback: FindingFeedbackRecord) {
  const prisma = getPrisma();
  if (!prisma || !isDatabaseConfigured()) return null;

  const [saved] = await prisma.$queryRaw<FindingFeedbackRecord[]>`
    INSERT INTO "FindingFeedback" ("id", "userId", "projectKey", "findingId", "helpful", "createdAt", "updatedAt")
    VALUES (${randomUUID()}, ${userId}, ${feedback.projectKey}, ${feedback.findingId}, ${feedback.helpful}, NOW(), NOW())
    ON CONFLICT ("userId", "projectKey", "findingId")
    DO UPDATE SET "helpful" = EXCLUDED."helpful", "updatedAt" = NOW()
    RETURNING "projectKey", "findingId", "helpful"
  `;

  return saved ?? null;
}
