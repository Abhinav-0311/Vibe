import { NextResponse } from "next/server";

export type ApiErrorCode =
  | "auth_required"
  | "invalid_request"
  | "invalid_upload"
  | "quota_exceeded"
  | "service_unavailable"
  | "rate_limited"
  | "scan_failed";

export function apiError(
  error: string,
  code: ApiErrorCode,
  status: number,
  options: { retryAfterSeconds?: number } = {},
) {
  return NextResponse.json(
    { error, code },
    {
      status,
      headers: options.retryAfterSeconds
        ? { "Retry-After": options.retryAfterSeconds.toString() }
        : undefined,
    },
  );
}

export function scanQuotaError(quota: { allowed: boolean; retryAfterSeconds: number; unavailable?: boolean }) {
  if (quota.allowed) return null;
  return apiError(
    quota.unavailable ? "Scanning is temporarily unavailable. Try again shortly." : "Daily scan limit reached. Try again later.",
    quota.unavailable ? "service_unavailable" : "quota_exceeded",
    quota.unavailable ? 503 : 429,
    { retryAfterSeconds: quota.retryAfterSeconds },
  );
}
