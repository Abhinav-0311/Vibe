import type { AuditContext } from "@/lib/checklist/types";

export type AuditProfileMode = "auto" | "manual";

export function readBoolean(value: string | null) {
  return value === "true";
}

export function readAuditContext(searchParams: URLSearchParams): AuditContext {
  const appType = searchParams.get("appType");
  const stage = searchParams.get("stage");

  return {
    appType:
      appType === "saas" ||
      appType === "marketplace" ||
      appType === "internal-tool" ||
      appType === "content-site" ||
      appType === "portfolio" ||
      appType === "api" ||
      appType === "unknown"
        ? appType
        : "saas",
    stage: stage === "launch-prep" || stage === "production" ? stage : "prototype",
    hasPayments: readBoolean(searchParams.get("hasPayments")),
    hasUserAccounts: readBoolean(searchParams.get("hasUserAccounts")),
    storesUserData: readBoolean(searchParams.get("storesUserData")),
  };
}

export function readAuditProfileMode(searchParams: URLSearchParams): AuditProfileMode {
  return searchParams.get("profileMode") === "manual" ? "manual" : "auto";
}
