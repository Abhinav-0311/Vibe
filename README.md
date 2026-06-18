# Vibe

Vibe is a launch-readiness auditor for AI-built apps.

It helps new coders, indie builders, and vibe coders answer one practical question:

> My app runs locally. Is it ready for real users?

Vibe scans a local project, detects production-readiness signals, runs context-aware checklist rules, generates a readable report, and turns findings into implementation prompts that can be handed to Codex, Cursor, Claude Code, or another coding agent.

## What It Does

- Scans local projects under a controlled workspace path.
- Detects framework, package manager, dependencies, routes, tests, environment files, middleware, analytics, observability, and AI workspace rules.
- Inventories Next.js API routes and classifies auth, payment, webhook, and health endpoints without executing project code.
- Checks environment-file Git ignore coverage without reading or exposing secret values.
- Detects in-repo rate-limiting evidence for sensitive API surfaces.
- Verifies that detected Stripe webhook routes contain signature-validation evidence.
- Detects wildcard CORS policies in API routes, middleware, and Next.js configuration.
- Checks local credential-auth projects for recovery, session termination, and explicit insecure cookie options.
- Scores the project against launch-readiness rules.
- Generates a deterministic executive report without relying on AI guesses.
- Shows an evidence ledger so users can see why the score changed.
- Saves scan history locally in the browser.
- Persists scan records to PostgreSQL with Prisma.
- Deduplicates repeated identical scans.
- Exports reports as copyable Markdown.
- Restores saved database scans into the full report UI.

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
- prompt queue
- Markdown report export
- local scan history
- PostgreSQL archive

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
```

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

## Scripts

```bash
npm.cmd run dev
npm.cmd run build
npm.cmd run start
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

## Security Boundary

The local scanner is intentionally constrained. Project paths must stay inside:

```text
E:\College\Project
```

This prevents the scan endpoint from becoming an unrestricted filesystem reader.

## Project Status

Vibe is currently an MVP/prototype.

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

Planned:

- GitHub issue generation
- AI-assisted report wording
- hosted multi-user mode
- auth and team workspaces

## Planning Docs

- [PRODUCT_BLUEPRINT.md](./PRODUCT_BLUEPRINT.md)
- [MVP_EXECUTION_PLAN.md](./MVP_EXECUTION_PLAN.md)
- [TECHNICAL_ARCHITECTURE.md](./TECHNICAL_ARCHITECTURE.md)
