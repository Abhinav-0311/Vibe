-- CreateTable
CREATE TABLE "ScanRecord" (
    "id" TEXT NOT NULL,
    "projectName" TEXT NOT NULL,
    "appType" TEXT NOT NULL,
    "stage" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "findingCount" INTEGER NOT NULL,
    "scannedAt" TIMESTAMP(3) NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScanRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ScanRecord_createdAt_idx" ON "ScanRecord"("createdAt");

-- CreateIndex
CREATE INDEX "ScanRecord_stage_createdAt_idx" ON "ScanRecord"("stage", "createdAt");

-- CreateIndex
CREATE INDEX "ScanRecord_appType_createdAt_idx" ON "ScanRecord"("appType", "createdAt");

-- CreateIndex
CREATE INDEX "ScanRecord_score_createdAt_idx" ON "ScanRecord"("score", "createdAt");
