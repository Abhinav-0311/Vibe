import type { AuditFinding } from "@/lib/mock-audit";

export function createPullRequestBrief(repository: string, finding: AuditFinding) {
  return `## ${finding.title}

### Why
${finding.impact}

### Evidence from Vibe
${finding.evidence}

### Scope
${finding.fix}

### Implementation plan
1. Make the smallest change that addresses the evidence above.
2. Keep the selected readiness profile and existing behavior intact.
3. Add or update a focused regression test.

### Verification
${finding.verification?.map((item) => `- ${item}`).join("\n") || "- Re-run the relevant test, then re-scan this repository in Vibe."}

### Vibe implementation prompt
${finding.prompt}

Generated for ${repository}. This brief proposes work only; it does not modify the repository.`;
}
