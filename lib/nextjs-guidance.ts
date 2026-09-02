import type { ScannerFacts } from "@/lib/scanner/types";

export const nextJsGuidanceCatalogVersion = "2026.09";

export type NextJsGuidance = {
  id: string;
  title: string;
  evidence: string;
  recommendation: string;
  verification: string;
  source: { label: string; url: string };
  catalogVersion: typeof nextJsGuidanceCatalogVersion;
};

export type FrameworkGuidance = NextJsGuidance;

function guidance(item: Omit<NextJsGuidance, "catalogVersion">): NextJsGuidance {
  return { ...item, catalogVersion: nextJsGuidanceCatalogVersion };
}

/** A small reviewed catalog selected only from scanner facts. */
export function getNextJsGuidance(facts: ScannerFacts): NextJsGuidance[] {
  if (facts.framework.name !== "Next.js") return getViteGuidance(facts);

  const guidanceItems: NextJsGuidance[] = [];
  if (facts.signals.hasAppRouter && (!facts.uiEvidence?.hasLoadingState || !facts.uiEvidence?.hasErrorState)) {
    guidanceItems.push(guidance({
      id: "nextjs-route-recovery",
      title: "Add recovery only where the scan found a gap",
      evidence: `App Router detected; loading state: ${facts.uiEvidence?.hasLoadingState ? "present" : "not detected"}, error state: ${facts.uiEvidence?.hasErrorState ? "present" : "not detected"}.`,
      recommendation: "Use loading.tsx or Suspense for real delayed content, and error.tsx for route-segment failures. Keep explicit form and event-handler errors in the workflow itself.",
      verification: "Load the affected route with a delayed request, then force its failure and confirm a clear recovery action is available.",
      source: { label: "Next.js error handling", url: "https://nextjs.org/docs/app/getting-started/error-handling" },
    }));
  }
  if (facts.apiRoutes.length > 0) {
    guidanceItems.push(guidance({
      id: "nextjs-route-handler-boundaries",
      title: "Keep route handlers at the boundary",
      evidence: `${facts.apiRoutes.length} API route${facts.apiRoutes.length === 1 ? "" : "s"} detected.`,
      recommendation: "Authenticate and validate input before side effects, keep ownership checks close to database queries, and return safe error responses rather than server details.",
      verification: "Exercise one valid request plus unauthenticated, malformed, and unauthorized cases; confirm each returns the expected safe status and body.",
      source: { label: "Next.js route handlers", url: "https://nextjs.org/docs/app/getting-started/route-handlers" },
    }));
  }
  if (!facts.signals.hasEnvExample) {
    guidanceItems.push(guidance({
      id: "nextjs-environment-boundaries",
      title: "Document public and server-only configuration",
      evidence: "No .env.example signal detected.",
      recommendation: "List required variables without values. Treat only NEXT_PUBLIC_ variables as browser-visible; keep tokens, database URLs, and secrets server-only.",
      verification: "Run the build with a safe example environment and inspect that no server-only variable is referenced in client code.",
      source: { label: "Next.js environment variables", url: "https://nextjs.org/docs/app/guides/environment-variables" },
    }));
  }
  if (!facts.signals.hasTests) {
    guidanceItems.push(guidance({
      id: "nextjs-verification-baseline",
      title: "Establish a focused verification baseline",
      evidence: "No test setup signal detected.",
      recommendation: "Start with route and domain tests for the scan’s highest-priority workflow before expanding to broad UI coverage.",
      verification: "Add one repeatable test command, then verify it catches a deliberately broken branch in the highest-priority workflow.",
      source: { label: "Next.js production checklist", url: "https://nextjs.org/docs/app/guides/production-checklist" },
    }));
  }

  return guidanceItems.slice(0, 3);
}

function getViteGuidance(facts: ScannerFacts): FrameworkGuidance[] {
  if (facts.framework.name !== "Vite" && facts.framework.name !== "Vite React") return [];

  const guidanceItems: FrameworkGuidance[] = [];
  if (facts.signals.hasEnvironmentVariableUsage && !facts.signals.hasEnvExample) {
    guidanceItems.push(guidance({
      id: "vite-environment-boundaries",
      title: "Document Vite environment boundaries",
      evidence: "Vite environment usage was detected, but no .env.example file was found.",
      recommendation: "Document required variables without values. Treat VITE_ variables as browser-visible and never place secrets, database credentials, or private API keys behind that prefix.",
      verification: "Build the app with safe placeholder values and verify that browser-visible variables contain no secrets while server-only values are handled by a backend boundary.",
      source: { label: "Vite environment variables", url: "https://vite.dev/guide/env-and-mode" },
    }));
  }
  if (!facts.signals.hasTests) {
    guidanceItems.push(guidance({
      id: "vite-verification-baseline",
      title: "Add a focused Vite verification baseline",
      evidence: "Vite project detected; no test setup signal was found.",
      recommendation: "Start with component or domain tests around the highest-value workflow, then add a small browser smoke test for the production build.",
      verification: "Add one repeatable test command and demonstrate that it fails when the primary workflow is deliberately broken.",
      source: { label: "Vite guide", url: "https://vite.dev/guide/" },
    }));
  }
  if (!facts.signals.hasBuildScript) {
    guidanceItems.push(guidance({
      id: "vite-production-build",
      title: "Define a production build command",
      evidence: "Vite project detected; no build script was found in package.json.",
      recommendation: "Add a production build script and validate its output in a clean environment before deployment.",
      verification: "Run the documented production build command and serve the generated output through the intended host or preview flow.",
      source: { label: "Vite build guide", url: "https://vite.dev/guide/build" },
    }));
  }

  return guidanceItems.slice(0, 3);
}

export function getFrameworkGuidance(facts: ScannerFacts): FrameworkGuidance[] {
  return getNextJsGuidance(facts);
}
