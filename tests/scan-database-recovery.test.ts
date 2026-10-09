import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ScanApiResponse } from "@/lib/scan-api";

const mocks = vi.hoisted(() => ({ getPrisma: vi.fn(() => null as unknown), reportServerError: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ getPrisma: mocks.getPrisma, isDatabaseConfigured: () => true }));
vi.mock("@/lib/observability/server", () => ({ reportServerError: mocks.reportServerError }));
vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));

import { enforceScanQuota } from "@/lib/auth";
import { findCachedGitHubScan, saveScanRecord } from "@/lib/db/scan-records";
import { enforcePublicScanRateLimit } from "@/lib/scan-rate-limit";

const database = {
  scanQuotaUsage: { deleteMany: vi.fn() },
  scanRateLimit: { deleteMany: vi.fn() },
  scanRecord: { deleteMany: vi.fn(), findUnique: vi.fn(), upsert: vi.fn(), findFirst: vi.fn() },
  $queryRaw: vi.fn(),
};

beforeEach(() => {
  vi.resetAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-08T23:59:00Z"));
  mocks.getPrisma.mockReturnValue(database);
  vi.stubEnv("VIBE_DAILY_SCAN_LIMIT", "20");
});

afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); });

describe("scan database recovery", () => {
  it("blocks scans rather than failing open when the quota store is unavailable", async () => {
    database.$queryRaw.mockRejectedValue(new Error("private database detail"));
    expect(await enforceScanQuota("test-user")).toEqual({ allowed: false, retryAfterSeconds: 60, remaining: 0, unavailable: true });
    expect(mocks.reportServerError).toHaveBeenCalledWith("scan_quota_unavailable", { status: 503 });
  });

  it("blocks scans when the database is not configured", async () => {
    mocks.getPrisma.mockReturnValue(null);
    expect(await enforceScanQuota("test-user")).toMatchObject({ allowed: false, retryAfterSeconds: 60, unavailable: true });
    expect(database.$queryRaw).not.toHaveBeenCalled();
  });

  it("classifies client initialization failures as unavailable rather than exhausted quota", async () => {
    mocks.getPrisma.mockImplementationOnce(() => { throw new Error("private connection detail"); });
    expect(await enforceScanQuota("test-user")).toEqual({ allowed: false, retryAfterSeconds: 60, remaining: 0, unavailable: true });
    expect(database.$queryRaw).not.toHaveBeenCalled();
    expect(mocks.reportServerError).toHaveBeenCalledWith("scan_quota_unavailable", { status: 503 });
  });

  it("returns the next UTC reset for an exhausted durable quota", async () => {
    database.$queryRaw.mockResolvedValue([]);
    expect(await enforceScanQuota("test-user")).toEqual({ allowed: false, retryAfterSeconds: 60, remaining: 0 });
  });

  it("resumes normal quota enforcement after the store recovers", async () => {
    database.$queryRaw.mockRejectedValueOnce(new Error("database unavailable")).mockResolvedValueOnce([{ count: 2 }]);
    expect(await enforceScanQuota("test-user")).toMatchObject({ allowed: false, unavailable: true });
    expect(await enforceScanQuota("test-user")).toEqual({ allowed: true, retryAfterSeconds: 60, remaining: 18 });
  });

  it("allows the first attempt after UTC midnight with a fresh daily quota", async () => {
    vi.setSystemTime(new Date("2026-10-09T00:00:00Z"));
    database.$queryRaw.mockResolvedValue([{ count: 1 }]);
    expect(await enforceScanQuota("test-user")).toEqual({ allowed: true, retryAfterSeconds: 86_400, remaining: 19 });
    expect(database.$queryRaw.mock.calls[0][0].values).toContainEqual(new Date("2026-10-09T00:00:00Z"));
  });

  it("keeps a bounded in-memory rate limit while the durable limiter is unavailable", async () => {
    database.$queryRaw.mockRejectedValue(new Error("database unavailable"));
    const request = new Request("http://localhost", { headers: { "x-forwarded-for": "192.0.2.88" } });
    for (let index = 0; index < 4; index++) expect((await enforcePublicScanRateLimit(request, "upload")).allowed).toBe(true);
    expect((await enforcePublicScanRateLimit(request, "upload")).allowed).toBe(false);
    await vi.advanceTimersByTimeAsync(60_000);
    expect((await enforcePublicScanRateLimit(request, "upload")).allowed).toBe(true);
  });

  it("returns a cache miss instead of breaking the scan when cached history cannot be read", async () => {
    database.scanRecord.findFirst.mockRejectedValue(new Error("private database detail"));
    expect(await findCachedGitHubScan("test-user", "test-fingerprint")).toBeNull();
    expect(mocks.reportServerError).toHaveBeenCalledWith("saved_scan_read_failed");
  });

  it("does not claim a scan was saved when the database write fails", async () => {
    database.scanRecord.upsert.mockRejectedValue(new Error("private database detail"));
    const scan = {
      scannedProject: "sample", scannedAt: "2026-10-08T23:59:00Z", facts: { projectRoot: "sample" },
      checklist: { score: 100, context: { appType: "content-site", stage: "prototype" }, findings: [], summary: { critical: 0, high: 0, medium: 0, low: 0 } },
    } as unknown as ScanApiResponse;
    expect(await saveScanRecord(scan, "test-user")).toEqual({ attempted: true, saved: false, reason: "database_error" });
    expect(mocks.reportServerError).toHaveBeenCalledWith("scan_persistence_failed");
    expect(database.scanRecord.upsert).toHaveBeenCalledOnce();
  });
});
