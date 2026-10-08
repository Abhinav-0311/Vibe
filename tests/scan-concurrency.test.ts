import AdmZip from "adm-zip";
import { promises as fs } from "node:fs";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AuditContext } from "@/lib/checklist/types";

vi.mock("@/lib/db/scan-records", () => ({ saveScanRecord: vi.fn(async () => ({ attempted: true, saved: true })) }));

import { createScanResponse } from "@/lib/scan-response";
import { createScanHash } from "@/lib/scan-fingerprint";
import { saveScanRecord } from "@/lib/db/scan-records";
import { extractProjectZipBuffer, UploadValidationError } from "@/lib/upload/zip-project";

const context: AuditContext = { appType: "content-site", stage: "prototype", hasPayments: false, hasUserAccounts: false, storesUserData: false };
const cases = [
  { name: "next-content", framework: "Next.js", dependencies: { next: "16.3.0", react: "19.0.0" }, source: "app/page.tsx" },
  { name: "vite-content", framework: "Vite React", dependencies: { vite: "6.0.0", react: "19.0.0" }, source: "src/App.tsx" },
  { name: "express-api", framework: "Express", dependencies: { express: "5.0.0" }, source: "src/server.js" },
].map((fixture) => {
  const zip = new AdmZip();
  zip.addFile(`${fixture.name}/package.json`, Buffer.from(JSON.stringify({
    name: fixture.name, dependencies: fixture.dependencies,
    scripts: { build: "echo fixture-only-command-never-executed" },
  })));
  zip.addFile(`${fixture.name}/${fixture.source}`, Buffer.from("export default function Page() { return <main>Public content</main>; }"));
  zip.addFile(`${fixture.name}/package-lock.json`, Buffer.from("{}"));
  zip.addFile(`${fixture.name}/.env.local`, Buffer.from("PRIVATE_VALUE=fixture-only-secret-must-not-leak\n"));
  zip.addFile(`${fixture.name}/.gitignore`, Buffer.from(".env*\n"));
  return { ...fixture, archive: zip.toBuffer() };
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("OPENAI_REPORT_ENABLED", "false");
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Load tests must not make network requests")));
});

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

async function scan(fixture: typeof cases[number], userId: string) {
  const startedAt = performance.now();
  const project = await extractProjectZipBuffer(fixture.archive);
  try {
    const response = await createScanResponse(project.projectRoot, context, { type: "upload", label: "ZIP upload" }, fixture.name, "auto", userId, project.repositoryRoot);
    expect(response.facts.framework.name).toBe(fixture.framework);
    expect(response.report.generation).toMatchObject({ mode: "deterministic", fallbackReason: "disabled" });
    expect(response.setupPack).toBeDefined();
    expect(response.architectureStress).toBeDefined();
    expect(response.persistence).toEqual({ attempted: true, saved: true });
    expect(JSON.stringify(response)).not.toContain("fixture-only-secret-must-not-leak");
    expect(JSON.stringify(response)).not.toContain("fixture-only-command-never-executed");
    return { hash: createScanHash(response), projectRoot: project.projectRoot, ms: performance.now() - startedAt };
  } finally {
    await project.cleanup();
  }
}

describe("bounded local scan concurrency (external services disabled)", () => {
  it.each([1, 5, 10, 20])("preserves deterministic results and cleans up %i concurrent scans", async (concurrency) => {
    const baselines = await Promise.all(cases.map((fixture) => scan(fixture, "baseline-user")));
    vi.mocked(saveScanRecord).mockClear();
    const startedAt = performance.now();
    const outcomes = await Promise.allSettled(Array.from({ length: concurrency }, (_, index) => scan(cases[index % cases.length], `load-user-${index}`)));
    const elapsedMs = performance.now() - startedAt;
    expect(outcomes.filter((outcome) => outcome.status === "rejected")).toEqual([]);
    const results = outcomes.map((outcome) => {
      if (outcome.status === "rejected") throw outcome.reason;
      return outcome.value;
    });
    expect(new Set(results.map((result) => result.projectRoot)).size).toBe(concurrency);
    for (const [index, result] of results.entries()) {
      expect(result.hash).toBe(baselines[index % cases.length].hash);
      await expect(fs.access(path.dirname(result.projectRoot))).rejects.toMatchObject({ code: "ENOENT" });
      expect(saveScanRecord).toHaveBeenCalledWith(expect.objectContaining({ scannedProject: cases[index % cases.length].name }), `load-user-${index}`, expect.any(Object));
    }
    expect(saveScanRecord).toHaveBeenCalledTimes(concurrency);
    expect(fetch).not.toHaveBeenCalled();
    const durations = results.map((result) => result.ms).sort((a, b) => a - b);
    // Diagnostic measurements, not machine-dependent pass/fail thresholds or hosted capacity claims.
    console.info(JSON.stringify({ localScanLoad: { concurrency, completed: results.length, elapsedMs: Math.round(elapsedMs), p50Ms: Math.round(durations[Math.ceil(concurrency * 0.5) - 1]), p95Ms: Math.round(durations[Math.ceil(concurrency * 0.95) - 1]) } }));
  }, 30_000);

  it("isolates corrupt uploads and cleans all temporary directories in a mixed 20-job batch", async () => {
    const temporaryRoots = vi.spyOn(fs, "mkdtemp");
    const outcomes = await Promise.allSettled(Array.from({ length: 20 }, (_, index) => index % 4 === 0
      ? extractProjectZipBuffer(Buffer.from("corrupt ZIP"))
      : scan(cases[index % cases.length], `mixed-user-${index}`)));
    expect(outcomes.filter((outcome) => outcome.status === "fulfilled")).toHaveLength(15);
    const failures = outcomes.filter((outcome) => outcome.status === "rejected");
    expect(failures).toHaveLength(5);
    for (const failure of failures) {
      if (failure.status === "rejected") expect(failure.reason).toBeInstanceOf(UploadValidationError);
    }
    expect(temporaryRoots).toHaveBeenCalledTimes(20);
    const roots = await Promise.all(temporaryRoots.mock.results.map((result) => result.value as Promise<string>));
    expect(new Set(roots).size).toBe(20);
    for (const root of roots) await expect(fs.access(root)).rejects.toMatchObject({ code: "ENOENT" });
    expect(saveScanRecord).toHaveBeenCalledTimes(15);
    expect(fetch).not.toHaveBeenCalled();
  }, 30_000);
});
