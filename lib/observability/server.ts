type ServerErrorEvent =
  | "scan_persistence_failed"
  | "saved_scan_read_failed"
  | "github_scan_failed"
  | "upload_scan_failed"
  | "guidance_feedback_read_failed"
  | "guidance_feedback_write_failed"
  | "finding_feedback_read_failed"
  | "finding_feedback_write_failed";

export function reportServerError(event: ServerErrorEvent, details: Record<string, string | number | boolean> = {}) {
  // Structured Vercel runtime logs are the production monitoring surface for the
  // single-user MVP. Details must stay low-cardinality and secret-free.
  console.error(JSON.stringify({ event: `vibe.${event}`, ...details }));
}
