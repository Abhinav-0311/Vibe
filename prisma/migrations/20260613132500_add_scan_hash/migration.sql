-- Add the column as nullable first because existing rows need a backfilled value.
ALTER TABLE "ScanRecord" ADD COLUMN "scanHash" TEXT;

-- Existing rows predate deterministic scan hashes. Give each legacy row a stable unique value.
UPDATE "ScanRecord"
SET "scanHash" = 'legacy-' || "id"
WHERE "scanHash" IS NULL;

ALTER TABLE "ScanRecord" ALTER COLUMN "scanHash" SET NOT NULL;

CREATE UNIQUE INDEX "ScanRecord_scanHash_key" ON "ScanRecord"("scanHash");
