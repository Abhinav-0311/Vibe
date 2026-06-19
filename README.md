# Vibe

Vibe is a launch-readiness auditor for AI-built apps.

It helps new coders, indie builders, and vibe coders answer one practical question:

> My app runs locally. Is it ready for real users?

Vibe scans local folders, uploaded ZIP archives, and GitHub repositories; detects production-readiness signals; runs context-aware checklist rules; and turns evidence-backed findings into a verified implementation workflow.

## What It Does

- Scans local projects under a controlled workspace path.
- Detects framework, package manager, dependencies, routes, tests, environment files, middleware, analytics, observability, and AI workspace rules.
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
- Generates a deterministic Markdown implementation plan from triaged findings.
- Creates a dedicated GitHub fix branch and draft pull request only after explicit user actions.
- Compares re-scans to show resolved, remaining, and newly introduced findings.
- Reports GitHub rate limits, permission failures, missing branches, and oversized repositories clearly.
- Generates a project-specific AI workspace setup pack without inventing unknown business facts.
- Exports `AGENTS.md`, product, decision, roadmap, and user-profile memory, a session-start checklist, and an MCP/API wiring checklist as a ZIP.
- Optionally improves report narrative and implementation prompts through evidence-constrained OpenAI structured output.
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
- Fix Assistant with prompt queue and Markdown implementation plan
- Markdown report export
- local scan history
- PostgreSQL archive
- GitHub repository and branch picker
- GitHub issue creation from a selected finding
- explicit GitHub fix-branch and draft-pull-request handoff
- before-and-after scan comparison
- architecture stress-test evidence and next actions
- AI workspace setup-pack preview and ZIP export

### Persistence

Vibe supports two memory layers:

- browser local history for quick local use
- PostgreSQL scan records for durable storage

Database records are deduplicated with a deterministic scan hash.

## Getting Started

Install dependencies:

```bash
npm.cmd install
```

Create a local `.env` file:

```env
NEXT_PUBLIC_APP_URL=http://localhost:3005
OPENAI_API_KEY=sk-placeholder
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/vibe?schema=public
SENTRY_DSN=
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
GITHUB_TOKEN_ENCRYPTION_KEY=replace-with-at-least-32-random-characters
OPENAI_REPORT_ENABLED=false
OPENAI_REPORT_MODEL=gpt-5.4-mini
```

## AI Report Enhancement

Every scan first creates a complete deterministic report. OpenAI enhancement is optional and cannot change the score, readiness label, severities, categories, finding IDs, or evidence.

To enable it:

1. Replace `sk-placeholder` with a real server-side `OPENAI_API_KEY` in `.env`.
2. Set `OPENAI_REPORT_ENABLED=true`.
3. Keep `OPENAI_REPORT_MODEL` configurable for model availability and cost control.
4. Restart the development server.

Vibe sends normalized framework metadata, dependency names, route metadata, context, and findings. It does not send repository source code, environment values, package-script bodies, or the local project path. Requests use the Responses API with strict structured output and `store: false`. A timeout, API failure, or invalid response preserves the deterministic report.

Keep AI enhancement disabled on an unauthenticated public deployment. The current MVP flag is intended for trusted local use; hosted usage controls belong with the authentication and workspace phase.

Generate Prisma Client:

```bash
npm.cmd run db:generate
```

Run the app:

```bash
npm.cmd run dev -- --port 3005
```

Open:

```text
http://localhost:3005
```

## PostgreSQL Setup

This project is currently configured for local PostgreSQL.

Example local database:

```text
host: localhost
port: 5432
database: vibe
user: postgres
```

Create the database:

```powershell
& "E:\Tools\Postgre\bin\createdb.exe" -h localhost -p 5432 -U postgres vibe
```

Run migrations:

```bash
npm.cmd run db:migrate -- --name init_scan_records
```

Useful database commands:

```bash
npm.cmd run db:generate
npm.cmd run db:migrate
npm.cmd run db:deploy
npm.cmd run db:studio
```

Docker Compose is also included for machines that prefer containerized Postgres:

```bash
docker compose up -d
```

The Docker database uses host port `5433` to avoid conflicts with an existing native PostgreSQL installation or another project using `5432`:

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5433/vibe?schema=public
```

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

```text
GET /api/github/status
GET /api/github/repos
GET /api/github/branches
POST /api/github/branches
POST /api/github/issues
POST /api/github/pull-requests
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
- Fix Assistant plan, branch, draft-PR, and re-scan workflow
- `/api/health`, GitHub Actions verification, and deployment/rollback runbook
- portfolio case study and architecture diagram

Planned:

- hosted multi-user mode
- authentication, tenant isolation, and team workspaces
- billing, quotas, and background scan jobs
- additional framework support

## Planning Docs

- [PRODUCT_BLUEPRINT.md](./PRODUCT_BLUEPRINT.md)
- [MVP_EXECUTION_PLAN.md](./MVP_EXECUTION_PLAN.md)
- [TECHNICAL_ARCHITECTURE.md](./TECHNICAL_ARCHITECTURE.md)
- [Deployment and recovery](./docs/DEPLOYMENT.md)
- [Portfolio case study](./docs/PORTFOLIO_CASE_STUDY.md)
- [MVP QA report](./docs/MVP_QA_REPORT.md)
