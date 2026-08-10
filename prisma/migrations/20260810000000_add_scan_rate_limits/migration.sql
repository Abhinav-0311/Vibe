CREATE TABLE "ScanRateLimit" (
    "key" TEXT NOT NULL,
    "windowStart" TIMESTAMP(3) NOT NULL,
    "count" INTEGER NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScanRateLimit_pkey" PRIMARY KEY ("key")
);

CREATE INDEX "ScanRateLimit_updatedAt_idx" ON "ScanRateLimit"("updatedAt");
