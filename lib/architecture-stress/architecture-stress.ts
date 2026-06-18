import type { ChecklistResult } from "@/lib/checklist/types";
import type { ScannerFacts } from "@/lib/scanner/types";
import type {
  ArchitectureStressAssessment,
  ArchitectureStressResult,
  ArchitectureStressStatus,
} from "@/lib/architecture-stress/types";

const databaseDependencies = [
  "@prisma/client",
  "prisma",
  "drizzle-orm",
  "mongoose",
  "pg",
  "mysql2",
  "@supabase/supabase-js",
];
const hostedVendorDependencies = [
  "@clerk/nextjs",
  "@supabase/supabase-js",
  "@vercel/postgres",
  "firebase",
  "openai",
  "stripe",
];
const meteredDependencies = [
  "openai",
  "@anthropic-ai/sdk",
  "@google/generative-ai",
  "stripe",
  "@vercel/blob",
  "@aws-sdk/client-s3",
];

function dependencyNames(facts: ScannerFacts) {
  return new Set(facts.dependencies.map((dependency) => dependency.name));
}

function detectedPath(facts: ScannerFacts, paths: string[]) {
  return facts.detectedFiles.some((file) => file.exists && paths.includes(file.path));
}

function statusScore(status: ArchitectureStressStatus) {
  if (status === "resilient") return 2;
  if (status === "watch") return 1;
  return 0;
}

function schemaAssessment(facts: ScannerFacts): ArchitectureStressAssessment {
  const dependencies = dependencyNames(facts);
  const hasDatabase = databaseDependencies.some((dependency) => dependencies.has(dependency));
  const hasSchema = detectedPath(facts, ["prisma/schema.prisma", "drizzle", "supabase/migrations"]);
  const hasMigrations = detectedPath(facts, ["prisma/migrations", "drizzle", "supabase/migrations"]);

  if (!hasDatabase) {
    return {
      id: "schema",
      title: "Schema resilience",
      status: "watch",
      summary: "No supported database layer was detected, so schema evolution cannot be verified.",
      evidence: ["No recognized database client appears in package dependencies."],
      actions: ["Re-run this audit after adding persistent data or document why the product is intentionally stateless."],
    };
  }

  return {
    id: "schema",
    title: "Schema resilience",
    status: hasSchema && hasMigrations ? "resilient" : "at-risk",
    summary: hasSchema && hasMigrations
      ? "A versioned schema and migration history provide a reviewable path for data changes."
      : "A database dependency exists without both a detected schema and migration history.",
    evidence: [
      `Database layer: ${databaseDependencies.filter((dependency) => dependencies.has(dependency)).join(", ")}.`,
      `Versioned schema: ${hasSchema ? "detected" : "not detected"}; migrations: ${hasMigrations ? "detected" : "not detected"}.`,
    ],
    actions: hasSchema && hasMigrations
      ? ["Test forward migrations against a production-like backup before release."]
      : ["Add versioned migrations and document backup, deploy, and recovery order."],
  };
}

function securityAssessment(facts: ScannerFacts, checklist: ChecklistResult): ArchitectureStressAssessment {
  const securityFindings = checklist.findings.filter((finding) =>
    ["security", "auth", "payments"].some((category) => finding.category.toLowerCase().includes(category)),
  );
  const blockers = securityFindings.filter((finding) => finding.severity === "critical" || finding.severity === "high");
  const status: ArchitectureStressStatus = blockers.length > 0
    ? "at-risk"
    : facts.apiRoutes.length > 0 && !facts.signals.hasRateLimitImplementation
      ? "watch"
      : "resilient";

  return {
    id: "security",
    title: "Security blind spots",
    status,
    summary: blockers.length > 0
      ? `${blockers.length} high-priority security, authentication, or payment finding${blockers.length === 1 ? "" : "s"} remain open.`
      : "No high-priority security blind spot was identified by the current deterministic rules.",
    evidence: blockers.length > 0
      ? blockers.slice(0, 3).map((finding) => `${finding.title}: ${finding.evidence}`)
      : [`${facts.apiRoutes.length} API route${facts.apiRoutes.length === 1 ? "" : "s"} inspected; wildcard CORS: ${facts.signals.hasWildcardCors ? "detected" : "not detected"}.`],
    actions: blockers.length > 0
      ? ["Resolve critical and high security findings before expanding access or handling live payments."]
      : ["Repeat threat review whenever authentication, payments, uploads, or privileged tools are added."],
  };
}

function portabilityAssessment(facts: ScannerFacts): ArchitectureStressAssessment {
  const dependencies = dependencyNames(facts);
  const vendors = hostedVendorDependencies.filter((dependency) => dependencies.has(dependency));
  return {
    id: "portability",
    title: "Vendor portability",
    status: vendors.length >= 3 ? "at-risk" : vendors.length > 0 ? "watch" : "resilient",
    summary: vendors.length > 0
      ? `${vendors.length} hosted-provider SDK${vendors.length === 1 ? "" : "s"} may shape migration cost and failure boundaries.`
      : "No supported hosted-provider SDK was detected in package dependencies.",
    evidence: vendors.length > 0 ? [`Detected provider SDKs: ${vendors.join(", ")}.`] : ["No recognized provider-specific SDK detected."],
    actions: vendors.length > 0
      ? ["Keep provider calls behind narrow modules and document the data export or replacement path."]
      : ["Preserve portable interfaces as infrastructure dependencies are introduced."],
  };
}

function costAssessment(facts: ScannerFacts): ArchitectureStressAssessment {
  const dependencies = dependencyNames(facts);
  const metered = meteredDependencies.filter((dependency) => dependencies.has(dependency));
  return {
    id: "cost",
    title: "Cost exposure",
    status: metered.length >= 2 ? "at-risk" : metered.length === 1 ? "watch" : "resilient",
    summary: metered.length > 0
      ? "Metered services were detected, but repository evidence cannot prove budgets, quotas, or per-user limits."
      : "No recognized metered-service SDK was detected.",
    evidence: metered.length > 0 ? [`Metered integrations: ${metered.join(", ")}.`] : ["No recognized AI, payment, object-storage, or cloud SDK detected."],
    actions: metered.length > 0
      ? ["Define request limits, timeout and retry budgets, usage telemetry, and a monthly spend alert."]
      : ["Add cost ownership and usage limits when metered infrastructure is introduced."],
  };
}

function recoveryAssessment(facts: ScannerFacts): ArchitectureStressAssessment {
  const hasHealth = facts.signals.hasHealthRoute;
  const hasTests = facts.signals.hasTests;
  const hasObservability = facts.signals.hasErrorTrackingDependency || facts.signals.hasObservabilityPlan;
  const count = [hasHealth, hasTests, hasObservability].filter(Boolean).length;
  return {
    id: "recovery",
    title: "Failure recovery",
    status: count === 3 ? "resilient" : count >= 1 ? "watch" : "at-risk",
    summary: count === 3
      ? "Tests, health evidence, and an observability surface support failure detection and diagnosis."
      : "Failure detection or recovery evidence is incomplete.",
    evidence: [
      `Tests: ${hasTests ? "detected" : "missing"}; health route: ${hasHealth ? "detected" : "missing"}; observability: ${hasObservability ? "detected" : "missing"}.`,
    ],
    actions: count === 3
      ? ["Document incident ownership, database recovery, and deployment rollback before public launch."]
      : ["Add the missing test, health, and observability layers, then document rollback and data recovery."],
  };
}

function stabilityAssessment(facts: ScannerFacts, checklist: ChecklistResult): ArchitectureStressAssessment {
  const highPriority = checklist.findings.filter((finding) => finding.severity === "critical" || finding.severity === "high");
  const releaseInputs = facts.signals.hasLockfile && facts.signals.hasBuildScript && facts.signals.hasTests;
  return {
    id: "stability",
    title: "Completion versus stability",
    status: highPriority.length > 0 ? "at-risk" : releaseInputs ? "resilient" : "watch",
    summary: highPriority.length > 0
      ? "The product surface may be complete, but high-priority readiness findings still threaten stable operation."
      : releaseInputs
        ? "A lockfile, production build, and tests provide repeatable release inputs."
        : "The release process is missing at least one repeatability signal.",
    evidence: [
      `Lockfile: ${facts.signals.hasLockfile ? "detected" : "missing"}; build: ${facts.signals.hasBuildScript ? "detected" : "missing"}; tests: ${facts.signals.hasTests ? "detected" : "missing"}.`,
      `Critical or high findings: ${highPriority.length}.`,
    ],
    actions: highPriority.length > 0
      ? ["Treat critical and high findings as release work, not post-launch polish."]
      : ["Keep build and test verification mandatory for every release candidate."],
  };
}

export function runArchitectureStressTest(
  facts: ScannerFacts,
  checklist: ChecklistResult,
): ArchitectureStressResult {
  const assessments = [
    schemaAssessment(facts),
    securityAssessment(facts, checklist),
    portabilityAssessment(facts),
    costAssessment(facts),
    recoveryAssessment(facts),
    stabilityAssessment(facts, checklist),
  ];
  const score = Math.round(
    assessments.reduce((total, assessment) => total + statusScore(assessment.status), 0) /
      (assessments.length * 2) *
      100,
  );

  return {
    score,
    label: score >= 75 ? "Resilient" : score >= 45 ? "Needs review" : "At risk",
    assessments,
    disclaimer: "This is repository-evidence engineering triage, not a security, compliance, cost, or availability guarantee.",
  };
}
