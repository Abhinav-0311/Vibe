# MVP Execution Plan

## Build Order

### Phase 0: Product Foundation

Goal: establish the project direction and development baseline.

Tasks:

- Create product blueprint.
- Create technical architecture.
- Define first supported stack.
- Define initial scanner categories.
- Define AI workspace readiness categories.
- Confirm MVP flow before implementation.

Exit criteria:

- Planning docs exist.
- MVP scope is narrow and buildable.
- Implementation can start without guessing product direction.

### Phase 1: App Foundation

Goal: create the web app shell.

Tasks:

- Initialize Next.js with TypeScript.
- Add Tailwind CSS.
- Add shadcn/ui foundation.
- Add core layout.
- Add dashboard route.
- Add report route.
- Add empty, loading, and error states.

Verification:

- App starts locally.
- Dashboard renders.
- Mobile and desktop layouts are usable.

### Phase 2: Local Scanner Core

Goal: scan a local or uploaded Next.js project without executing its code.

Tasks:

- Add scanner module.
- Detect package manager.
- Parse `package.json`.
- Detect Next.js routes and app structure.
- Detect auth, Stripe, analytics, error tracking, tests, env files, middleware, and policy routes.
- Detect AI workspace files such as `AGENTS.md`, `.cursor/rules`, `.cursorrules`, Claude/Codex notes, and project memory docs.
- Return structured scanner facts.

Verification:

- Scanner can run against at least one sample project.
- Scanner output is JSON and stable.
- No scanned project code is executed.

### Phase 3: Checklist Engine

Goal: convert scanner facts into production-readiness findings.

Tasks:

- Define checklist item schema.
- Implement auth checks.
- Implement security checks.
- Implement payment checks.
- Implement reliability checks.
- Implement launch basics checks.
- Implement AI workspace readiness checks.
- Add severity and confidence scoring.

Verification:

- Findings include category, severity, evidence, and recommended fix.
- Missing signals produce clear findings.
- Existing signals reduce false positives.

### Phase 4: AI Report Layer

Goal: turn scanner findings into a useful launch report.

Tasks:

- Define report prompt with strict JSON input.
- Generate executive summary.
- Generate fix prompts per finding.
- Generate AI operating-context prompts for rules files, memory files, and session startup checklists.
- Generate readiness score.
- Store generated report locally or in database.

Verification:

- Report is specific to scanner evidence.
- Prompts are actionable and stack-aware.
- Generic findings are rejected or downgraded.

Status: complete. OpenAI enhancement is opt-in, schema-constrained, evidence-only, and falls back to the deterministic report on any failure.

### Phase 5: Report UI

Goal: make findings easy to understand and act on.

Tasks:

- Build readiness score summary.
- Build severity sections.
- Build finding detail panel.
- Build copy prompt action.
- Build status states for open, ignored, fixed later.
- Add empty, loading, error, hover, and focus states.

Verification:

- User can understand top risks within 10 seconds.
- User can copy a fix prompt in one click.
- UI remains clean on mobile and desktop.

### Phase 6: Persistence

Goal: save projects, scans, findings, and reports.

Tasks:

- Add database schema.
- Persist projects.
- Persist scans.
- Persist findings.
- Persist generated prompts.
- Add scan history.

Verification:

- User can reopen prior scan results.
- Data model supports multiple scans per project.

### Phase 7: GitHub Integration

Goal: make Vibe work with real repositories.

Tasks:

- Add GitHub OAuth or GitHub App.
- List user repositories.
- Clone or fetch repository contents safely.
- Create GitHub issue text from findings.
- Add issue export action.

Verification:

- User can connect a repo.
- User can scan it.
- User can create issue drafts or issues.

### Phase 8: AI Workspace Setup Pack

Goal: turn AI workspace findings into concrete setup artifacts.

Tasks:

- Generate a project-specific `AGENTS.md` or rules file draft.
- Generate a memory file structure for product facts, pricing, roadmap, user profile, and decisions.
- Generate a session-start checklist.
- Generate an MCP/API wiring checklist without storing credentials.
- Add export actions for the setup pack.

Verification:

- User can export a useful AI workspace checklist.
- Generated files are specific to the project type.
- No secrets or credentials are requested or stored.

Status: complete. New scans generate seven evidence-backed Markdown artifacts and support individual or ZIP export.

## First Coding Milestone

The first coding milestone should be Phase 1 plus a mocked report screen.

Why:

- It creates the product surface quickly.
- It lets us validate design direction.
- Scanner and AI work can attach to a real interface later.

## Lead Manager Rules

- Keep the wedge narrow: Next.js SaaS first.
- Do not add auto-fixing until reports are useful.
- Do not support every framework.
- Do not claim guaranteed security.
- Every finding must be evidence-backed when possible.
- The report must prioritize critical blockers over long checklists.
- Treat AI workspace setup as context infrastructure, not magic business automation.

## Immediate Next Decision

Before coding, choose the first app foundation style:

1. Full SaaS dashboard with mocked scan/report data.
2. Local-only scanner CLI plus minimal web report.
3. Hybrid: web dashboard first, scanner module second.

Recommended: option 3.
