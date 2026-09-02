-- Per-user feedback for curated, versioned guidance. No scan or repository content is stored here.
CREATE TABLE "GuidanceFeedback" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "guidanceId" TEXT NOT NULL,
    "catalogVersion" TEXT NOT NULL,
    "helpful" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "GuidanceFeedback_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "GuidanceFeedback_userId_guidanceId_catalogVersion_key" ON "GuidanceFeedback"("userId", "guidanceId", "catalogVersion");
CREATE INDEX "GuidanceFeedback_userId_updatedAt_idx" ON "GuidanceFeedback"("userId", "updatedAt");

ALTER TABLE "GuidanceFeedback" ADD CONSTRAINT "GuidanceFeedback_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
