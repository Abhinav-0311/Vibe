export type AnalyticsEvent =
  | "project_created"
  | "scan_started"
  | "scan_completed"
  | "scan_failed"
  | "finding_selected"
  | "finding_status_changed"
  | "prompt_copied"
  | "prompt_queue_copied"
  | "fix_plan_downloaded"
  | "fix_branch_created"
  | "draft_pull_request_created"
  | "rescan_compared";

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
  {
    name: "fix_plan_downloaded",
    purpose: "Measure whether users export the evidence-backed implementation plan.",
    properties: ["queued_count", "project_source"],
  },
  {
    name: "fix_branch_created",
    purpose: "Measure explicit GitHub handoffs from findings to implementation.",
    properties: ["repository", "base_branch", "finding_count"],
  },
  {
    name: "draft_pull_request_created",
    purpose: "Measure completed GitHub handoffs after users push their fixes.",
    properties: ["repository", "base_branch", "head_branch", "finding_count"],
  },
  {
    name: "rescan_compared",
    purpose: "Measure whether users verify fixes with new repository evidence.",
    properties: ["score_delta", "resolved_count", "remaining_count", "introduced_count"],
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
