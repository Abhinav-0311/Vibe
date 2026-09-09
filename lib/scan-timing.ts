/** Formats a completed static scan duration without implying a zero-duration scan. */
export function formatScanProcessingTime(processingMs: number) {
  if (!Number.isFinite(processingMs) || processingMs < 100) return "under 0.1s";
  return `${(processingMs / 1000).toFixed(1)}s`;
}
