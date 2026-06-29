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

1. Keep the context on `launch-prep`.
2. Scan the current local project or a known public GitHub repository.
3. Wait for the report state.

Say:

> The scanner reads repository structure, dependencies, routes, config, tests, environment hygiene, and AI workspace files. It turns those facts into deterministic findings instead of asking an LLM to guess.

Proves:

- safe static analysis
- context-aware scoring
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

## Step 4: Show The Fix Assistant

Action:

1. Scroll to `Implementation handoff`.
2. Show the readiness roadmap.
3. Show `Copy queue` and `Download plan`.

Say:

> Vibe does not stop at diagnosis. It creates an ordered implementation path: fix first, fix next, then verify and re-scan.

Proves:

- triage workflow
- implementation sequencing
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

- hosted authentication
- team workspaces
- scan quotas and billing
- background scan jobs
- more frameworks beyond Node.js
- deeper UI/UX heuristics
