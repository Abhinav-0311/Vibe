# Vibe

Vibe is a launch-readiness auditor for AI-built apps. It scans a project, finds the production systems a builder likely missed, and turns each finding into evidence, teaching, and an implementation handoff.

Live deployment: [vibe-seven-snowy.vercel.app](https://vibe-seven-snowy.vercel.app)

Production status: deployed from `main` with PostgreSQL-backed scan history and durable public-scan rate limiting. Check [`/api/health`](https://vibe-seven-snowy.vercel.app/api/health) for the current application and database status.

It helps new coders, indie builders, and vibe coders answer one practical question:

> My app runs locally. Is it ready for real users?

Vibe scans local folders, uploaded ZIP archives, and GitHub repositories; detects production-readiness signals; runs context-aware checklist rules; and turns evidence-backed findings into clear explanations and copyable fix prompts.

Hosted deployments should use GitHub or ZIP scanning. Local folder scanning is for trusted local/self-hosted use only and is disabled by default on Vercel.

## Scan Safety

Vibe is a static repository scanner. It reads files and metadata, but it does not execute scanned project code.

- It does not run `npm install`, lifecycle scripts, tests, builds, migrations, or app servers from the scanned repository.
- ZIP uploads are size-limited, path-validated, extracted to a temporary folder, scanned, and removed after the request finishes.
- GitHub scans download a repository archive for inspection. Private repositories require OAuth, and GitHub issues are created only after explicit user action.
- Local folder scanning is limited to the configured workspace path and should only be enabled in trusted local or self-hosted environments.
- Environment files are detected by filename and ignore rules; Vibe should not print or expose secret values.
- Findings are evidence-based static signals, not a proof of runtime security. Users can mark findings as not relevant with a reason.

## Publication Links

- [Phase 4 publication QA](./docs/PHASE_4_PUBLICATION_QA.md)
- [Portfolio case study](./docs/PORTFOLIO_CASE_STUDY.md)
- [MVP QA report](./docs/MVP_QA_REPORT.md)
- [Future roadmap](./docs/FUTURE_ROADMAP.md)
- [Limitations](./docs/LIMITATIONS.md)
- [Trust and safety](./docs/TRUST_AND_SAFETY.md)
- [Vercel deployment](./docs/VERCEL.md)
- [Deployment and recovery](./docs/DEPLOYMENT.md)

## Screenshots

### Scan Input

![Vibe scan input](./docs/assets/vibe-scan-input.png)

### Score Breakdown

![Vibe score breakdown](./docs/assets/vibe-score-breakdown.png)

### Finding Detail

![Vibe finding detail](./docs/assets/vibe-finding-detail.png)

## What It Does

- Scans local projects under a controlled workspace path in trusted local development.
- Supports GitHub repository and ZIP upload scanning for hosted deployments.
- Detects root and nested Node.js app folders inside GitHub repositories and ZIP uploads.
- Detects framework, package manager, dependencies, routes, tests, environment files, middleware, analytics, observability, and AI workspace rules.
- Recognizes common Node.js app types including Next.js, Vite React, Vite, Create React App, Remix, Astro, SvelteKit, Nuxt, Express, and NestJS.
- Inventories Next.js API routes and classifies auth, payment, webhook, and health endpoints without executing project code.
- Checks environment-file Git ignore coverage without reading or exposing secret values.
- Detects in-repo rate-limiting evidence for sensitive API surfaces.
- Verifies that detected Stripe webhook routes contain signature-validation evidence.
- Detects wildcard CORS policies in API routes, middleware, and Next.js configuration.
- Checks local credential-auth projects for recovery, session termination, and explicit insecure cookie options.
- Checks lockfiles, production build scripts, unsafe dev-server start commands, and disabled Next.js build validation.
- Scores the project against launch-readiness rules.
- Generates a deterministic executive report without relying on AI guesses.
- Shows an evidence ledger so users can see why the score changed.
- Saves scan history locally in the browser.
- Persists scan records to PostgreSQL with Prisma.
- Deduplicates repeated identical scans.
- Exports reports as copyable Markdown.
- Restores saved database scans into the full report UI.
- Scans public or private GitHub repositories on a selected branch.
- Turns individual findings into GitHub issues after explicit user approval.
- Reports GitHub rate limits, permission failures, missing branches, and oversized repositories clearly.
- Generates a project-specific AI workspace setup pack without inventing unknown business facts.
- Exports `AGENTS.md`, product, decision, roadmap, and user-profile memory, a session-start checklist, and an MCP/API wiring checklist as a ZIP.
- Optionally improves report narrative and implementation prompts through evidence-constrained OpenAI structured output.
- Provides a small versioned Next.js guidance catalog with scanner-specific evidence, official documentation links, verification routes, and owner-scoped helpfulness feedback.
- Provides a small versioned Next.js guidance catalog with scanner-specific evidence, official documentation links, verification routes, and owner-scoped helpfulness feedback.
- Runs a deterministic six-lens architecture stress test covering schema evolution, security, portability, cost, recovery, and stability.
- Exposes dependency-aware service health at `/api/health`.
- Enforces tests and the production build through GitHub Actions.

## Why This Exists

AI tools make it easy to build screens quickly. Production requires different systems:

- authentication and account recovery
- rate limiting and middleware
- payment safety
- environment documentation
- testing
- analytics
- observability
- durable AI operating rules
- clear implementation prompts

Vibe is built to teach those gaps while giving builders an actionable next step.

## Tech Stack

Frontend:

- Next.js App Router
- React 19
- TypeScript
- Tailwind CSS v4
- Lucide React icons

Backend:

- Next.js Route Handlers
- Node.js filesystem scanner
- Deterministic checklist engine
- Prisma ORM
- PostgreSQL
- GitHub REST API and OAuth 2.0 with PKCE

Testing and tooling:

- Vitest
- Prisma Migrate
- Docker Compose support for local Postgres

## Current Features

### Project Scanner

The scanner reads local project files and detects:

- `package.json`
- nested app folders such as `client`, `frontend`, `app`, `web`, and `server`
- lockfiles
- Next.js config
- App Router / Pages Router
- middleware
- `.env.example`
- tests
- auth packages
- Stripe packages
- analytics setup
- observability setup
- AI rules files such as `AGENTS.md`

### Context-Aware Checklist

The checklist changes severity based on project context:

- prototype
- launch prep
- production
- SaaS
- internal tool
- content site
- API
- user accounts
- payments
- user data storage

### Report UI

The dashboard includes:

- project picker
- project path scanner
- readiness score
- generated report narrative
- evidence ledger
- route-level API evidence
- secret-file hygiene and rate-limit checks
- prioritized findings
- Markdown report export
- local scan history
- PostgreSQL archive
- GitHub repository and branch picker
- GitHub issue creation from a selected finding
- architecture stress-test evidence and next actions
- AI workspace setup-pack preview and ZIP export

### Persistence

Vibe supports two memory layers:

- browser local history for quick local use
- PostgreSQL scan records for durable storage

Database records are deduplicated with a deterministic scan hash.

## Quick Start

Install dependencies:

```powershell
npm.cmd install
```

Create a local `.env` file:

```env
NEXT_PUBLIC_APP_URL=http://localhost:3005
VIBE_ENABLE_LOCAL_SCAN=
OPENAI_API_KEY=
DATABASE_URL=postgresql://postgres:postgres@localhost:5433/vibe?schema=public
SENTRY_DSN=
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
GITHUB_TOKEN_ENCRYPTION_KEY=replace-with-at-least-32-random-characters
OPENAI_REPORT_ENABLED=false
OPENAI_REPORT_MODEL=gpt-5.4-mini
```

Start PostgreSQL with Docker:

```powershell
docker compose up -d
```

Generate Prisma Client:

```powershell
npm.cmd run db:generate
```

Apply migrations:

```powershell
npm.cmd run db:deploy
```

Run the app:

```powershell
npm.cmd run dev -- --port 3005
```

Open:

```text
http://localhost:3005
```

## PostgreSQL Setup

The recommended MVP setup is Docker PostgreSQL on host port `5433`. This avoids conflicts with native PostgreSQL installations on `5432`.

Use this `DATABASE_URL`:

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5433/vibe?schema=public
```

Start the database:

```powershell
docker compose up -d
```

Apply existing migrations:

```powershell
npm.cmd run db:deploy
```

Useful database commands:

```powershell
npm.cmd run db:generate
npm.cmd run db:migrate
npm.cmd run db:deploy
npm.cmd run db:studio
```

If you intentionally use native PostgreSQL instead, create a `vibe` database yourself and change `DATABASE_URL` to match your local port, username, and password.

Example native PostgreSQL URL:

```env
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/vibe?schema=public
```

## AI Report Enhancement

Every scan first creates a complete deterministic report. OpenAI enhancement is optional and cannot change the score, readiness label, severities, categories, finding IDs, or evidence.

To enable it:

1. Add a real server-side `OPENAI_API_KEY` in `.env`.
2. Set `OPENAI_REPORT_ENABLED=true`.
3. Keep `OPENAI_REPORT_MODEL` configurable for model availability and cost control.
4. Optionally set `OPENAI_REPORT_INPUT_COST_PER_MILLION_USD` and `OPENAI_REPORT_OUTPUT_COST_PER_MILLION_USD` using the current price for the selected model. Vibe records an estimate only when both values are set.
5. Restart the development server.

AI output is deliberately bounded: Vibe keeps the deterministic readiness score, findings, evidence, and report wording intact. The optional model returns one FixPlan per finding; each plan must preserve the finding ID, copy its scanner evidence and verification route exactly, and pass schema validation. Failed validation falls back to the deterministic report.

Vibe sends normalized framework metadata, dependency names, route metadata, context, and findings. It does not send repository source code, environment values, package-script bodies, or the local project path. Requests use the Responses API with strict structured output and `store: false`. A timeout, API failure, or invalid response preserves the deterministic report.

Keep AI enhancement disabled on an unauthenticated public deployment. The current MVP flag is intended for trusted local use; hosted usage controls belong with the authentication and workspace phase.

## Demo Flow

Use this flow for a clean MVP walkthrough:

1. Start Docker Postgres with `docker compose up -d`.
2. Run `npm.cmd run db:deploy`.
3. Start Vibe with `npm.cmd run dev -- --port 3005`.
4. Scan a local project, public GitHub repo, private GitHub repo, or ZIP upload.
5. Review the readiness score, score breakdown, and UI/UX category score.
6. Open the top finding and read the evidence, learning note, suggested fix, and copyable prompt.
7. Copy the report or a focused finding prompt.
8. Re-scan after fixes to generate a fresh readiness report.

## What This Shows As An AI Engineering Project

Vibe is not only a frontend demo. It shows:

- deterministic codebase scanning without executing user code
- evidence-backed scoring instead of generic AI opinions
- prompt generation that is grounded in detected repository facts
- optional AI enhancement with structured-output guardrails
- GitHub OAuth, branch selection, and issue creation from findings
- PostgreSQL persistence, deduplication, restore, and health visibility
- tests around scanner, checklist, reports, GitHub handling, setup packs, and health checks

## GitHub Setup

Public repository URLs work without authentication. To scan private repositories, choose branches, and create issues, create a GitHub OAuth App:

1. Open GitHub Settings, Developer settings, OAuth Apps, then choose **New OAuth App**.
2. Set the homepage URL to `http://localhost:3005`.
3. Set the authorization callback URL to `http://localhost:3005/api/github/oauth/callback`.
4. Add the OAuth App client ID and client secret to your local `.env` file.
5. Generate a random encryption key containing at least 32 characters and set `GITHUB_TOKEN_ENCRYPTION_KEY`.
6. Restart the development server and use **Connect GitHub** in the audit context panel.

The integration requests GitHub's `repo` scope. This permits private-repository access and issue creation. The access token is encrypted in an HTTP-only cookie, never returned to browser JavaScript, and removed when the user disconnects.

## Scripts

```bash
npm.cmd run dev
npm.cmd run build
npm.cmd run start
npm.cmd run lint
npm.cmd run test
npm.cmd run db:generate
npm.cmd run db:migrate
npm.cmd run db:deploy
npm.cmd run db:studio
```

## API Routes

```text
GET /api/projects
```

Discovers scannable local projects under the workspace root.

```text
GET /api/scan
```

Runs a project scan. Supports query parameters:

- `projectPath`
- `stage`
- `appType`
- `hasPayments`
- `hasUserAccounts`
- `storesUserData`

```text
GET /api/scans
```

Lists saved PostgreSQL scan records.

```text
GET /api/scans/[id]
```

Loads a saved scan record and restores the full report payload.

```text
POST /api/github-scan
```

Scans a public or connected private GitHub repository. Accepts `repoUrl`, optional `branch`, and the audit-context fields.
If the repository root does not contain `package.json`, Vibe searches nested app folders and scans the best detected Node.js project root.

```text
GET /api/github/status
GET /api/github/repos
GET /api/github/branches
POST /api/github/issues
POST /api/github/disconnect
```

Manage the GitHub connection, repository and branch selection, and explicit issue creation.

```text
POST /api/setup-pack/export
```

Validates and exports the generated AI workspace artifacts as a ZIP archive. Artifact paths are restricted to safe Markdown paths and content size is bounded.

```text
GET /api/health
```

Reports application and PostgreSQL readiness without exposing configuration values. A missing or unreachable database returns HTTP `503`.

## Security Boundary

The local scanner is intentionally constrained to the parent of the running application directory. The UI reads this root from the server instead of hard-coding a machine-specific path. This prevents the scan endpoint from becoming an unrestricted filesystem reader.

## Project Status

Vibe's single-user MVP is feature complete. Hosted multi-user product work remains post-MVP.

Built:

- scanner
- checklist engine
- deterministic report generator
- Markdown report export
- local history
- PostgreSQL persistence
- saved scan restore
- project discovery
- evidence ledger
- private GitHub repository scanning
- branch selection and rate-limit-aware errors
- GitHub issue generation
- evidence-backed AI workspace setup packs
- individual file copy/download and complete ZIP export
- opt-in AI report narrative and implementation-prompt enhancement
- deterministic fallback with model latency and token-usage metadata
- deterministic architecture stress test
- `/api/health`, GitHub Actions verification, and deployment/rollback runbook
- portfolio case study and architecture diagram

Planned:

- hosted multi-user mode
- authentication, tenant isolation, and team workspaces
- billing, quotas, and background scan jobs
- additional framework support

## Planning Docs

- [Product blueprint](./docs/planning/PRODUCT_BLUEPRINT.md)
- [MVP execution plan](./docs/planning/MVP_EXECUTION_PLAN.md)
- [Technical architecture](./docs/planning/TECHNICAL_ARCHITECTURE.md)
- [Deployment and recovery](./docs/DEPLOYMENT.md)
- [Portfolio case study](./docs/PORTFOLIO_CASE_STUDY.md)
- [MVP QA report](./docs/MVP_QA_REPORT.md)
- [Future roadmap](./docs/FUTURE_ROADMAP.md)
- [Limitations](./docs/LIMITATIONS.md)
