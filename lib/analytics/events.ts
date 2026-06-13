export type AnalyticsEvent =
  | "project_created"
  | "scan_started"
  | "scan_completed"
  | "scan_failed"
  | "finding_selected"
  | "finding_status_changed"
  | "prompt_copied"
  | "prompt_queue_copied";

export type AnalyticsEventDefinition = {
  name: AnalyticsEvent;
  purpose: string;
  properties: string[];
};

export const analyticsEvents: AnalyticsEventDefinition[] = [
  {
    name: "project_created",
    purpose: "Understand how often users start a new audit workspace.",
    properties: ["project_id", "app_type", "stage"],
  },
  {
    name: "scan_started",
    purpose: "Measure scanner usage and context choices before a scan runs.",
    properties: ["project_id", "app_type", "stage", "has_payments", "has_user_accounts"],
  },
  {
    name: "scan_completed",
    purpose: "Measure scan success, readiness score, and finding volume.",
    properties: ["project_id", "score", "finding_count", "critical_count", "high_count"],
  },
  {
    name: "scan_failed",
    purpose: "Identify scanner reliability problems before users report them.",
    properties: ["project_id", "error_message", "stage"],
  },
  {
    name: "finding_selected",
    purpose: "Learn which categories users inspect most often.",
    properties: ["finding_id", "category", "severity"],
  },
  {
    name: "finding_status_changed",
    purpose: "Measure whether findings become planned, ignored, or remain open.",
    properties: ["finding_id", "category", "severity", "status"],
  },
  {
    name: "prompt_copied",
    purpose: "Measure whether individual findings lead to implementation action.",
    properties: ["finding_id", "category", "severity"],
  },
  {
    name: "prompt_queue_copied",
    purpose: "Measure whether users export a full implementation queue.",
    properties: ["queued_count", "planned_count", "open_count"],
  },
];

export function trackEvent(event: AnalyticsEvent, properties: Record<string, string | number | boolean>) {
  if (process.env.NODE_ENV !== "production") {
    return;
  }

  // Vendor wiring intentionally comes later. This keeps the event contract stable
  // before choosing PostHog, Vercel Analytics, or another provider.
  void event;
  void properties;
}
