import { NextResponse } from "next/server";

export type ApiErrorCode =
  | "auth_required"
  | "invalid_request"
  | "invalid_upload"
  | "quota_exceeded"
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
