export type ObservabilitySignal =
  | "scan_failed"
  | "scanner_rule_failed"
  | "api_route_failed"
  | "prompt_copy_failed"
  | "report_render_failed";

export type ObservabilityPlanItem = {
  signal: ObservabilitySignal;
  whyItMatters: string;
  firstResponse: string;
  futureTooling: "console" | "sentry" | "posthog" | "logs";
};

export const observabilityPlan: ObservabilityPlanItem[] = [
  {
    signal: "scan_failed",
    whyItMatters: "A failed scan blocks the core product workflow.",
    firstResponse: "Show a clear retry path and preserve the user's selected audit context.",
    futureTooling: "sentry",
  },
  {
    signal: "scanner_rule_failed",
    whyItMatters: "A broken rule can produce missing or misleading findings.",
    firstResponse: "Capture the rule id, project context, and scanner facts shape.",
    futureTooling: "logs",
  },
  {
    signal: "api_route_failed",
    whyItMatters: "API failures prevent the dashboard from receiving scan results.",
    firstResponse: "Return a safe error message and keep detailed failure data server-side.",
    futureTooling: "sentry",
  },
  {
    signal: "prompt_copy_failed",
    whyItMatters: "Prompt copying is one of the main product actions.",
    firstResponse: "Keep the prompt visible and let the user manually select it.",
    futureTooling: "posthog",
  },
  {
    signal: "report_render_failed",
    whyItMatters: "A report rendering crash makes the scan result unusable.",
    firstResponse: "Show an error state and avoid losing the underlying scan data.",
    futureTooling: "sentry",
  },
];

export function reportClientError(signal: ObservabilitySignal, details: Record<string, string>) {
  if (process.env.NODE_ENV !== "production") {
    return;
  }

  // Vendor wiring intentionally comes later. This plan defines what we will
  // capture before choosing Sentry, logs, or product analytics events.
  void signal;
  void details;
}
