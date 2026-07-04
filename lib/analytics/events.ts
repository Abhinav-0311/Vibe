export type AnalyticsEvent =
  | "project_created"
  | "scan_started"
  | "scan_completed"
  | "scan_failed"
  | "finding_selected"
  | "prompt_copied"
  | "report_copied"
  | "setup_pack_exported"
  | "github_issue_created";

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
    name: "prompt_copied",
    purpose: "Measure whether individual findings lead to implementation action.",
    properties: ["finding_id", "category", "severity"],
  },
  {
    name: "report_copied",
    purpose: "Measure whether users export the generated readiness report.",
    properties: ["project_id", "score", "finding_count"],
  },
  {
    name: "setup_pack_exported",
    purpose: "Measure whether users export AI workspace setup artifacts.",
    properties: ["artifact_count", "project_source"],
  },
  {
    name: "github_issue_created",
    purpose: "Measure explicit GitHub issue handoffs from selected findings.",
    properties: ["repository", "finding_id", "category", "severity"],
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
