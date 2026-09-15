export type ScanTelemetrySource = "local" | "upload" | "github";

type ScanTelemetry = {
  source: ScanTelemetrySource;
  totalMs: number;
  sourceMs?: number;
  extractionMs?: number;
  analysisMs?: number;
  enhancementMs?: number;
  setupPackMs?: number;
  architectureStressMs?: number;
  persistenceMs?: number;
  cacheHit?: boolean;
};

/**
 * Vercel structured logs are intentionally the observability surface for the
 * beta. This accepts durations and coarse source names only—never repository
 * names, file paths, user IDs, code, or secrets.
 */
export function reportScanCompleted(telemetry: ScanTelemetry) {
  console.info(JSON.stringify({ event: "vibe.scan_completed", ...telemetry }));
}
