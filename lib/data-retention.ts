const defaultScanRetentionDays = 30;
const defaultRateLimitRetentionHours = 24;

function positiveInteger(value: string | undefined, fallback: number) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export function scanRetentionDays() {
  return positiveInteger(process.env.VIBE_SCAN_RETENTION_DAYS, defaultScanRetentionDays);
}

export function scanRetentionCutoff(now = new Date()) {
  return new Date(now.getTime() - scanRetentionDays() * 24 * 60 * 60 * 1000);
}

export function rateLimitRetentionCutoff(now = new Date()) {
  return new Date(now.getTime() - defaultRateLimitRetentionHours * 60 * 60 * 1000);
}
