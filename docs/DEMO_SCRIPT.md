# Vibe Demo Script

Use this as the 5 to 7 minute portfolio walkthrough.

## Setup

Run these before the demo:

```powershell
cd E:\College\Project\Vibe
docker compose up -d
npm.cmd run db:deploy
npm.cmd run dev -- --port 3005
```

Open:

```text
http://localhost:3005
```

## Opening

Say:

> Vibe answers one question for AI-built apps: the app runs locally, but what launch-critical systems did the builder miss?

Point out:

- local folder, GitHub repo, and ZIP scan options
- no scanned project code is executed
- context changes the scoring rules

## Step 1: Run A Scan

Action:

1. Keep the default context unless you are intentionally demoing a SaaS app.
2. Scan a known public GitHub repository, or upload a ZIP when you want a predictable offline demo.
3. Wait for the report state.

Reliable public demo repos:

- Simple portfolio/content site: `https://github.com/Aayush10016/HipHopHub`
- More app-like repository: use a Node.js project with `package.json`, routes, and UI states

For a portfolio repo, call out that Vibe should avoid SaaS-only warnings such as payment, auth, and account recovery unless the repository actually contains those signals.

Say:

> The scanner reads repository structure, dependencies, routes, config, tests, environment hygiene, and AI workspace files. It turns those facts into deterministic findings instead of asking an LLM to guess.

Proves:

- safe static analysis
- context-aware scoring
- portfolio and SaaS scans are scored differently
- usable input methods

## Step 2: Explain The Score

Action:

1. Show the main readiness score.
2. Show the score breakdown.
3. Point specifically at `UI/UX`.

Say:

> The score is not one vague number. It is broken into categories like Security, Reliability, Launch Basics, AI Workspace, and UI/UX. The UI/UX score drops when the scanner sees missing loading states, error states, alt text, form labels, or placeholder copy.

Proves:

- product-risk framing
- UI/UX readiness is first-class
- score is tied to findings

## Step 3: Open A Finding

Action:

1. Select the highest-priority finding.
2. Show evidence, impact, suggested fix, learning note, and copy prompt.

Say:

> Each finding explains what was detected, why it matters, why builders usually miss it, and what prompt to give a coding agent. The prompt is grounded in repository evidence.

Proves:

- educational value for new coders
- actionable handoff for experienced devs
- evidence-backed prompt generation

## Step 4: Show The Report Export

Action:

1. Scroll to `Implementation handoff`.
2. Show the generated report narrative.
3. Use `Copy report`.

Say:

> Vibe does not stop at diagnosis. It gives the builder a concise report they can share, save, or use as the next prompt context.

Proves:

- report handoff
- evidence-backed next-step context
- coding-agent handoff

## Step 5: Show Persistence

Action:

1. Open `More evidence`.
2. Show `Database archive`.
3. Point at the DB status pill and saved records.

Say:

> Scans are saved to PostgreSQL when the database is connected, deduplicated by scan hash, and restorable into the full report UI.

Proves:

- PostgreSQL persistence
- health visibility
- durable report history

## Step 6: Show AI Workspace Setup Pack

Action:

1. Open the setup pack section.
2. Preview `AGENTS.md` or memory files.
3. Mention ZIP export.

Say:

> Vibe also helps configure the AI workspace itself: rules, memory, session checklist, and integration checklist. Unknown business facts are marked as TODOs instead of invented.

Proves:

- agent-operating-context design
- safety against hallucinated business facts
- exportable project setup artifacts

## Step 7: Close With Engineering Value

Say:

> The key engineering decision is that deterministic evidence remains the source of truth. AI is optional and constrained to improving wording and prompts. It cannot change scores, severities, evidence, or finding IDs.

Mention:

- Next.js App Router and route handlers
- Prisma and PostgreSQL
- GitHub REST API and OAuth path
- Vitest coverage
- optional OpenAI structured-output enhancement

## If Asked What Is Next

Answer:

- Vercel production deployment with managed PostgreSQL
- GitHub OAuth verification on the production domain
- final screenshots and launch README cleanup
- scan quotas and abuse controls
- hosted auth and user accounts
- team workspaces
- billing
- background scan jobs
- more frameworks beyond Node.js
- deeper UI/UX heuristics
