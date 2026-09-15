ALTER TABLE "ScanRecord" ADD COLUMN "sourceFingerprint" TEXT;

CREATE INDEX "ScanRecord_userId_sourceFingerprint_updatedAt_idx"
ON "ScanRecord"("userId", "sourceFingerprint", "updatedAt");
