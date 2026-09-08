CREATE TABLE "ScanQuotaUsage" (
    "userId" TEXT NOT NULL,
    "windowStart" TIMESTAMP(3) NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScanQuotaUsage_pkey" PRIMARY KEY ("userId", "windowStart")
);

CREATE INDEX "ScanQuotaUsage_updatedAt_idx" ON "ScanQuotaUsage"("updatedAt");

ALTER TABLE "ScanQuotaUsage"
ADD CONSTRAINT "ScanQuotaUsage_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
