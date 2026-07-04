# MVP QA Report

Date: 2026-07-05

## Automated Gates

- ESLint 9: passed with no warnings or errors
- Vitest: 88 tests across 17 files passed
- Next.js production build: passed
- TypeScript validation: passed through the production build
- Secret-pattern scan: no committed GitHub or OpenAI token pattern detected

Latest local commands:

```powershell
npm.cmd test
npm.cmd run lint
npm.cmd run build
```

## Browser Smoke Test

Environment: local Next.js server at `http://localhost:3005`.

- Homepage loaded and exposed the primary scan actions.
- A local Vibe scan completed and persisted a server-side scan record.
- `/api/health` returned application `ok` and database `ok`.
- `/api/scans` returned PostgreSQL saved scan records.
- Architecture stress results rendered all six evidence lenses.
- Score breakdown rendered category scores, including UI/UX.
- Generated report and AI workspace setup pack rendered in the implementation handoff section.
- Database archive exposed the database health state and saved records.
- Public GitHub scans support repositories with nested Node.js app roots.
- Portfolio/content-site scans avoid SaaS-only findings when auth, payments, and user-data signals are absent.
- Hosted-mode copy explains that Vercel deployments should use GitHub or ZIP scanning rather than local filesystem scanning.

## Production Smoke Test

Environment: Vercel production deployment at `https://vibe-seven-snowy.vercel.app`.

- Production deployment is ready on commit `1ded341`.
- `/api/health` returned application `ok` and database `ok`.
- Production database migrations were applied to Neon PostgreSQL.
- Hosted deployment uses GitHub and ZIP scanning; local workspace scanning is disabled for Vercel.

## Known Environment Limits

- Live private-repository OAuth and GitHub issue creation require the deployment owner's GitHub OAuth credentials and were not mutated during automated QA.
- OpenAI enhancement remained disabled; deterministic fallback behavior is covered by mocked tests.
- Playwright MCP browser automation was not available in this Codex desktop session, so the latest visual smoke check used HTTP checks and automated unit/build gates rather than screenshots.

## Release Verdict

The single-user MVP is ready for a portfolio demo, public GitHub/ZIP scanning, and controlled Vercel deployment. Public multi-user SaaS access remains blocked on authentication, tenant isolation, quotas, billing, background jobs, and hosted abuse controls; those are explicitly post-MVP capabilities.
