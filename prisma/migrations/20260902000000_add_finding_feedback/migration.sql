CREATE TABLE "FindingFeedback" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "findingId" TEXT NOT NULL,
    "helpful" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FindingFeedback_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FindingFeedback_userId_findingId_key" ON "FindingFeedback"("userId", "findingId");
CREATE INDEX "FindingFeedback_userId_updatedAt_idx" ON "FindingFeedback"("userId", "updatedAt");

ALTER TABLE "FindingFeedback"
ADD CONSTRAINT "FindingFeedback_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
