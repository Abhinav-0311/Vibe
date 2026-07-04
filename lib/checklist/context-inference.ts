import type { AuditContext } from "@/lib/checklist/types";
import type { ScannerFacts } from "@/lib/scanner/types";

export type AuditProfileInference = {
  requested: AuditContext;
  applied: AuditContext;
  adjusted: boolean;
  reasons: string[];
};

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

function looksLikeApiProject(facts: ScannerFacts) {
  const framework = facts.framework.name.toLowerCase();
  return (
    facts.apiRoutes.length > 0 &&
    (framework.includes("express") ||
      framework.includes("nestjs") ||
      framework === "unknown" ||
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
  const reasons: string[] = [];

  if (hasAccounts) {
    inferred.hasUserAccounts = true;
    reasons.push("Auth dependency or auth route detected, so user accounts are enabled for scoring.");
  }

  if (hasPayments) {
    inferred.hasPayments = true;
    reasons.push("Stripe or payment route detected, so payment readiness is enabled for scoring.");
  }

  if (shouldPromoteFromContentProfile(requestedContext)) {
    if (hasPayments || hasAccounts) {
      inferred.appType = "saas";
      reasons.push("Account or payment signals make this closer to a SaaS app than a simple content site.");
    } else if (looksLikeApiProject(facts)) {
      inferred.appType = "api";
      reasons.push("Backend framework and API route signals make this closer to an API project.");
    } else if (!hasServerProductSignals(facts)) {
      inferred.appType = "content-site";
      reasons.push("No auth, payment, webhook, or backend operation signals were found, so Vibe kept the content-site profile.");
    }
  }

  if (requestedContext.stage === "prototype" && inferred.appType === "saas" && (hasAccounts || hasPayments)) {
    inferred.stage = "launch-prep";
    reasons.push("Because SaaS account/payment signals exist, Vibe moved the scan from prototype to launch-prep.");
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

export function inferAuditContext(facts: ScannerFacts, requestedContext: AuditContext): AuditContext {
  return inferAuditProfile(facts, requestedContext).applied;
}
