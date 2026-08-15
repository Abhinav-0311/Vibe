# MVP QA Report

Date: 2026-08-11

## Automated Gates

- ESLint 9: passed with no warnings or errors
- Vitest: 101 tests across 19 files passed
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

- Production deployment is ready on commit `cdce3c9`.
- `/api/health` returned application `ok` and database `ok`.
- Production database migrations were applied to Neon PostgreSQL.
- Hosted deployment uses GitHub and ZIP scanning; local workspace scanning is disabled for Vercel.
- Security headers are active: `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`, and `Cross-Origin-Opener-Policy`.
- Public GitHub and ZIP scans are limited to four requests per minute per visitor with durable PostgreSQL-backed enforcement.

## Phase 4 Browser QA

Environment: Vercel production deployment, verified with Playwright browser automation.

- Desktop visual smoke check completed at 1440px with no console warnings or errors.
- Responsive DOM checks at 375px, 768px, and 1440px found no horizontal overflow.
- All visible primary controls met a 42px or greater touch-target height; primary scan actions are 48px or greater.
- A real public scan of `Abhinav-0311/Vibe` completed successfully, rendered the score breakdown, empty finding state, report handoff, and AI workspace setup-pack preview.
- The self-scan returned 100/100 for the selected prototype/content-site context with no browser-console errors.

## Known Environment Limits

- OpenAI enhancement remained disabled; deterministic fallback behavior is covered by mocked tests.
- Live private-repository OAuth and GitHub issue creation still require a configured GitHub OAuth app and were not mutated during browser QA.

## Release Verdict

The single-user MVP is ready for a portfolio demo, public GitHub/ZIP scanning, and controlled Vercel deployment. Public multi-user SaaS access remains blocked on authentication, tenant isolation, quotas, billing, background jobs, and hosted abuse controls; those are explicitly post-MVP capabilities.
