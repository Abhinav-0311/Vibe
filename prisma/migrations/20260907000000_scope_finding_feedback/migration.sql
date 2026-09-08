ALTER TABLE "FindingFeedback" ADD COLUMN "projectKey" TEXT NOT NULL DEFAULT 'legacy';

DROP INDEX "FindingFeedback_userId_findingId_key";

CREATE UNIQUE INDEX "FindingFeedback_userId_projectKey_findingId_key"
ON "FindingFeedback"("userId", "projectKey", "findingId");

CREATE INDEX "FindingFeedback_userId_projectKey_updatedAt_idx"
ON "FindingFeedback"("userId", "projectKey", "updatedAt");
