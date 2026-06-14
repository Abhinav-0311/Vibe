import type { AuditContext } from "@/lib/checklist/types";

export function readBoolean(value: string | null) {
  return value === "true";
}

export function readAuditContext(searchParams: URLSearchParams): AuditContext {
  const appType = searchParams.get("appType");
  const stage = searchParams.get("stage");

  return {
    appType:
      appType === "marketplace" ||
      appType === "internal-tool" ||
      appType === "content-site" ||
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
