import type { AuditContext } from "@/lib/checklist/types";
import type { ScannerFacts } from "@/lib/scanner/types";

export type AuditProfileInference = {
  requested: AuditContext;
  applied: AuditContext;
  adjusted: boolean;
  reasons: string[];
};

export type AuditProfileWarning = {
  id: "accounts-without-data" | "accounts-on-content-profile";
  message: string;
  suggestion: {
    label: string;
    changes: Partial<AuditContext>;
  };
};

/**
 * Flags combinations that deserve a second look before Vibe applies them to
 * scoring. These are advisory only: the person scanning always keeps control
 * of the selected readiness profile.
 */
export function getAuditProfileWarnings(context: AuditContext): AuditProfileWarning[] {
  const warnings: AuditProfileWarning[] = [];

  if (context.hasUserAccounts && !context.storesUserData) {
    warnings.push({
      id: "accounts-without-data",
      message: "Real accounts normally require identity or session data. Confirm this is not only a visual login screen.",
      suggestion: {
        label: "Mark user data as stored",
        changes: { storesUserData: true },
      },
    });
  }

  if (context.hasUserAccounts && (context.appType === "content-site" || context.appType === "portfolio")) {
    warnings.push({
      id: "accounts-on-content-profile",
      message: "A public product with real accounts is usually closer to a SaaS app than a content or portfolio site.",
      suggestion: {
        label: "Use SaaS profile",
        changes: { appType: "saas" },
      },
    });
  }

  return warnings;
}

function hasServerProductSignals(facts: ScannerFacts) {
  return (
    facts.signals.hasAuthDependency ||
    facts.signals.hasAuthRoute ||
    facts.signals.hasPaymentRoute ||
    facts.signals.hasStripeDependency ||
    facts.signals.hasWebhookRoute ||
    facts.signals.hasHealthRoute
  );
}

function hasPersistedAccountDataEvidence(facts: ScannerFacts) {
  const dependencyNames = new Set(facts.dependencies.map((dependency) => dependency.name));
  const hasSupportedDataClient = ["@prisma/client", "prisma", "drizzle-orm", "@supabase/supabase-js", "@supabase/ssr"].some((name) =>
    dependencyNames.has(name),
  );
  const hasSchemaOrMigration = facts.detectedFiles.some(
    (file) => file.exists && ["prisma/schema.prisma", "prisma/migrations", "drizzle", "supabase/migrations"].includes(file.path),
  );

  return hasSupportedDataClient && hasSchemaOrMigration;
}

function looksLikeApiProject(facts: ScannerFacts) {
  const framework = facts.framework.name.toLowerCase();
  if (framework.includes("express") || framework.includes("nestjs")) return true;

  return (
    facts.apiRoutes.length > 0 &&
    (framework === "unknown" ||
      (!facts.signals.hasAppRouter && !facts.signals.hasPagesRouter))
  );
}

function shouldPromoteFromContentProfile(context: AuditContext) {
  return context.appType === "content-site" || context.appType === "unknown";
}

function contextsMatch(left: AuditContext, right: AuditContext) {
  return (
    left.appType === right.appType &&
    left.stage === right.stage &&
    left.hasPayments === right.hasPayments &&
    left.hasUserAccounts === right.hasUserAccounts &&
    left.storesUserData === right.storesUserData
  );
}

export function inferAuditProfile(facts: ScannerFacts, requestedContext: AuditContext): AuditProfileInference {
  const inferred: AuditContext = { ...requestedContext };
  const hasAccounts = facts.signals.hasAuthDependency || facts.signals.hasAuthRoute;
  const hasPayments = facts.signals.hasStripeDependency || facts.signals.hasPaymentRoute;
  const authLikeUiFiles = facts.uiEvidence?.authLikeUiFiles ?? [];
  const reasons: string[] = [];

  if (hasAccounts) {
    inferred.hasUserAccounts = true;
    reasons.push("Auth dependency or auth route detected, so user accounts are enabled for scoring.");
  }

  if (hasPayments) {
    inferred.hasPayments = true;
    reasons.push("Stripe or payment route detected, so payment readiness is enabled for scoring.");
  }

  if (hasAccounts && hasPersistedAccountDataEvidence(facts)) {
    inferred.storesUserData = true;
    reasons.push("Account and persisted data-store evidence were detected, so stored user data is enabled for scoring.");
  }

  if (shouldPromoteFromContentProfile(requestedContext)) {
    if (hasPayments || hasAccounts) {
      inferred.appType = "saas";
      reasons.push("Account or payment signals make this closer to a SaaS app than a simple content site.");
    } else if (looksLikeApiProject(facts)) {
      inferred.appType = "api";
      reasons.push("Backend framework or API route signals make this closer to an API project.");
    } else if (!hasServerProductSignals(facts)) {
      inferred.appType = "content-site";
      reasons.push("No auth, payment, webhook, or backend operation signals were found, so Vibe kept the content-site profile.");
    }
  }

  if (requestedContext.stage === "prototype" && inferred.appType === "saas" && (hasAccounts || hasPayments)) {
    inferred.stage = "launch-prep";
    reasons.push("Because SaaS account/payment signals exist, Vibe moved the scan from prototype to launch-prep.");
  }

  if (!requestedContext.hasUserAccounts && !hasAccounts && authLikeUiFiles.length > 0) {
    reasons.push(
      `Login or signup UI was detected in ${authLikeUiFiles.slice(0, 2).join(", ")}, but no auth dependency or server auth route was found. Vibe kept accounts disabled because UI alone does not prove authentication works.`,
    );
  }

  if (reasons.length === 0) {
    reasons.push("Vibe used the selected readiness profile without adjustment.");
  }

  return {
    requested: requestedContext,
    applied: inferred,
    adjusted: !contextsMatch(requestedContext, inferred),
    reasons,
  };
}

export function selectedAuditProfile(requestedContext: AuditContext, facts?: ScannerFacts): AuditProfileInference {
  const authLikeUiFiles = facts?.uiEvidence?.authLikeUiFiles ?? [];
  const hasVerifiedAccounts = facts?.signals.hasAuthDependency || facts?.signals.hasAuthRoute;
  const reasons = ["Vibe used the readiness profile you selected."];

  if (!requestedContext.hasUserAccounts && !hasVerifiedAccounts && authLikeUiFiles.length > 0) {
    reasons.push(
      `Login or signup UI was detected in ${authLikeUiFiles.slice(0, 2).join(", ")}, but no auth dependency or server auth route was found. The selected profile still controls scoring; UI alone does not prove authentication works.`,
    );
  }

  return {
    requested: requestedContext,
    applied: requestedContext,
    adjusted: false,
    reasons,
  };
}

export function inferAuditContext(facts: ScannerFacts, requestedContext: AuditContext): AuditContext {
  return inferAuditProfile(facts, requestedContext).applied;
}
