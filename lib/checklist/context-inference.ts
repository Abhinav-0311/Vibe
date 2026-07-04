import type { AuditContext } from "@/lib/checklist/types";
import type { ScannerFacts } from "@/lib/scanner/types";

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

export function inferAuditContext(facts: ScannerFacts, requestedContext: AuditContext): AuditContext {
  const inferred: AuditContext = { ...requestedContext };
  const hasAccounts = facts.signals.hasAuthDependency || facts.signals.hasAuthRoute;
  const hasPayments = facts.signals.hasStripeDependency || facts.signals.hasPaymentRoute;

  if (hasAccounts) inferred.hasUserAccounts = true;
  if (hasPayments) inferred.hasPayments = true;

  if (shouldPromoteFromContentProfile(requestedContext)) {
    if (hasPayments || hasAccounts) {
      inferred.appType = "saas";
    } else if (looksLikeApiProject(facts)) {
      inferred.appType = "api";
    } else if (!hasServerProductSignals(facts)) {
      inferred.appType = "content-site";
    }
  }

  if (requestedContext.stage === "prototype" && inferred.appType === "saas" && (hasAccounts || hasPayments)) {
    inferred.stage = "launch-prep";
  }

  return inferred;
}
