import type { Prisma } from "@prisma/client";
import { getPrisma, isDatabaseConfigured } from "@/lib/prisma";
import type { ScanApiResponse } from "@/lib/scan-api";
import { createScanHash } from "@/lib/scan-fingerprint";
import { scanRetentionCutoff } from "@/lib/data-retention";
import { reportServerError } from "@/lib/observability/server";
import { scanComparisonKey } from "@/lib/scan-comparison";

export type ScanPersistenceResult = {
  attempted: boolean;
  saved: boolean;
  deduplicated?: boolean;
  reason?: "missing_database_url" | "database_error";
};

export type SavedScanRecord = {
  id: string;
  projectName: string;
  sourceLabel: string;
  appType: string;
  stage: string;
  score: number;
  findingCount: number;
  scannedAt: string;
  createdAt: string;
  readinessLabel: string;
};

export type SavedScanDetail = SavedScanRecord & {
  scan: ScanApiResponse;
};

export type ReadinessTrendPoint = {
  id: string;
  projectName: string;
  score: number;
  findingCount: number;
  scannedAt: string;
  comparisonKey: string;
};

function toSavedScanRecord(record: {
  id: string;
  projectName: string;
  appType: string;
  stage: string;
  score: number;
  findingCount: number;
  scannedAt: Date;
  createdAt: Date;
  payload: Prisma.JsonValue;
}): SavedScanRecord {
  const payload = record.payload as unknown as ScanApiResponse;

  return {
    id: record.id,
    projectName: record.projectName,
    sourceLabel: payload.scanSource?.label ?? "Local workspace",
    appType: record.appType,
    stage: record.stage,
    score: record.score,
    findingCount: record.findingCount,
    scannedAt: record.scannedAt.toISOString(),
    createdAt: record.createdAt.toISOString(),
    readinessLabel: payload.report?.readinessLabel ?? "Saved scan",
  };
}

function getEffectiveRecordHash(record: { id: string; payload: Prisma.JsonValue }) {
  try {
    return createScanHash(record.payload as unknown as ScanApiResponse);
  } catch {
    return `unreadable-${record.id}`;
  }
}

function dedupeSavedScanRows<T extends { id: string; payload: Prisma.JsonValue }>(records: T[]) {
  const seen = new Set<string>();
  const deduped: T[] = [];

  for (const record of records) {
    const effectiveHash = getEffectiveRecordHash(record);

    if (seen.has(effectiveHash)) continue;

    seen.add(effectiveHash);
    deduped.push(record);
  }

  return deduped;
}

export async function saveScanRecord(scan: ScanApiResponse, userId: string): Promise<ScanPersistenceResult> {
  const prisma = getPrisma();

  if (!prisma) {
    return {
      attempted: false,
      saved: false,
      reason: "missing_database_url",
    };
  }

  try {
    await prisma.scanRecord.deleteMany({ where: { updatedAt: { lt: scanRetentionCutoff() } } });
    const scanHash = createScanHash(scan);
    const existingRecord = await prisma.scanRecord.findUnique({
      where: { userId_scanHash: { userId, scanHash } },
      select: { id: true },
    });

    await prisma.scanRecord.upsert({
      where: { userId_scanHash: { userId, scanHash } },
      create: {
        scanHash,
        userId,
        projectName: scan.scannedProject,
        appType: scan.checklist.context.appType,
        stage: scan.checklist.context.stage,
        score: scan.checklist.score,
        findingCount: scan.checklist.findings.length,
        scannedAt: new Date(scan.scannedAt),
        payload: scan as unknown as Prisma.InputJsonValue,
      },
      update: {
        projectName: scan.scannedProject,
        appType: scan.checklist.context.appType,
        stage: scan.checklist.context.stage,
        score: scan.checklist.score,
        findingCount: scan.checklist.findings.length,
        scannedAt: new Date(scan.scannedAt),
        payload: scan as unknown as Prisma.InputJsonValue,
      },
    });

    return {
      attempted: true,
      saved: true,
      deduplicated: Boolean(existingRecord),
    };
  } catch {
    reportServerError("scan_persistence_failed");

    return {
      attempted: true,
      saved: false,
      reason: "database_error",
    };
  }
}

export async function listSavedScanRecords(userId: string, limit = 6): Promise<SavedScanRecord[]> {
  const prisma = getPrisma();

  if (!prisma || !isDatabaseConfigured()) return [];

  const records = await prisma.scanRecord.findMany({
    where: { userId },
    orderBy: [{ scannedAt: "desc" }, { id: "desc" }],
    take: limit * 4,
    select: {
      id: true,
      projectName: true,
      appType: true,
      stage: true,
      score: true,
      findingCount: true,
      scannedAt: true,
      createdAt: true,
      payload: true,
    },
  });

  return dedupeSavedScanRows(records).slice(0, limit).map(toSavedScanRecord);
}

export async function getSavedScanRecord(id: string, userId: string): Promise<SavedScanDetail | null> {
  const prisma = getPrisma();

  if (!prisma || !isDatabaseConfigured()) return null;

  const record = await prisma.scanRecord.findFirst({
    where: { id, userId },
    select: {
      id: true,
      projectName: true,
      appType: true,
      stage: true,
      score: true,
      findingCount: true,
      scannedAt: true,
      createdAt: true,
      payload: true,
    },
  });

  if (!record) return null;

  return {
    ...toSavedScanRecord(record),
    scan: record.payload as unknown as ScanApiResponse,
  };
}

export async function listReadinessTrend(userId: string, limit = 12): Promise<ReadinessTrendPoint[]> {
  const prisma = getPrisma();
  if (!prisma || !isDatabaseConfigured()) return [];

  const records = await prisma.scanRecord.findMany({
    where: { userId },
    orderBy: [{ scannedAt: "desc" }, { id: "desc" }],
    take: limit,
    select: { id: true, projectName: true, score: true, findingCount: true, scannedAt: true, payload: true },
  });

  return records.reverse().map((record) => ({
    id: record.id,
    projectName: record.projectName,
    score: record.score,
    findingCount: record.findingCount,
    scannedAt: record.scannedAt.toISOString(),
    comparisonKey: scanComparisonKey(record.payload as unknown as ScanApiResponse),
  }));
}
