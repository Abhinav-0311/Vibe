import type { ScannerFacts } from "@/lib/scanner/types";

export type NextJsGuidance = { title: string; evidence: string; recommendation: string };

export function getNextJsGuidance(facts: ScannerFacts): NextJsGuidance[] {
  if (facts.framework.name !== "Next.js") return [];

  const guidance: NextJsGuidance[] = [];
  if (facts.signals.hasAppRouter) {
    guidance.push({
      title: "Define route boundaries",
      evidence: "Next.js App Router detected.",
      recommendation: "Add loading.tsx, error.tsx, and not-found.tsx only for routes where a useful recovery state is missing.",
    });
  }
  if (facts.apiRoutes.length > 0) {
    guidance.push({
      title: "Keep route handlers narrow",
      evidence: `${facts.apiRoutes.length} API route${facts.apiRoutes.length === 1 ? "" : "s"} detected.`,
      recommendation: "Authenticate before work, validate input at the route boundary, and return safe errors without exposing server details.",
    });
  }
  if (!facts.signals.hasEnvExample) {
    guidance.push({
      title: "Document runtime configuration",
      evidence: "No .env.example signal detected.",
      recommendation: "Document required public and server-only variables without values; validate required server variables at startup or first use.",
    });
  }
  if (!facts.signals.hasMiddleware && facts.signals.hasAuthRoute) {
    guidance.push({
      title: "Protect the server boundary",
      evidence: "Authentication routes exist but no middleware signal was detected.",
      recommendation: "Use middleware only for cheap route gating; keep ownership checks in server routes and database queries.",
    });
  }

  return guidance.slice(0, 3);
}
