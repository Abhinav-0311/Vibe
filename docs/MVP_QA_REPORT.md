# MVP QA Report

Local verification date: 2026-10-03. Browser/deployment observations below are from the earlier 2026-09-16 smoke test, not a new deployment verification.

## Automated Gates

- ESLint 9: passed with no warnings or errors
- Vitest: 181 tests across 28 executed test files passed
- Next.js production build: passed
- TypeScript validation: passed through the production build and standalone `tsc --noEmit`
- Prisma schema validation: passed; no migrations or database mutations were run
- Secret-pattern scan: no committed GitHub or OpenAI token pattern detected
- Coverage percentage: not measured; no coverage provider is installed, and no packages were installed for this verification

This validation reflects the current private-beta checkout, including scanner calibration fixtures, per-user beta controls, source-fingerprint caching, and comparable re-scan verification guidance.

## Final Correctness Fixes

- Account deletion expires the current browser's GitHub connection and pending OAuth cookies after database deletion succeeds.
- Confirmed deletion clears the account's browser scan history and triage keys, stops local persistence, and rejects late scan/restore results. Other accounts' browser data is preserved.
- Cleanup/sign-out failures no longer falsely claim that nothing was deleted. A missing server response is treated as an unknown outcome, not proof of failure.
- Monorepo app paths isolate comparisons, finding triage, and browser history. Direct comparisons also require the same target/profile and an earlier baseline.
- Added mocked route and cleanup regression tests; no real account was deleted for testing.
- Fresh Google login, copy/export, actual fix/re-scan, and deletion with a disposable account still need browser acceptance. Browser automation could not connect during this verification run.
- These changes are locally verified. Post-push CI, deployment status, and fresh browser acceptance are separate release checks.

Latest local commands:

```powershell
npm.cmd test
npm.cmd run lint
npm.cmd run build
npx.cmd --no-install tsc --noEmit
npx.cmd --no-install prisma validate
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

- The deployed private beta returned HTTP 200 from `/api/health` with application `ok` and database `ok`.
- Production database migrations were applied to Neon PostgreSQL.
- Hosted deployment uses GitHub and ZIP scanning; local workspace scanning is disabled for Vercel.
- Public GitHub and ZIP scans use durable PostgreSQL-backed enforcement in addition to per-user beta scan quotas.

## Previous Browser Smoke Test

Environment: Vercel production deployment, verified with Playwright browser automation.

- An authenticated browser session completed a public GitHub scan of `Abhinav-0311/Vibe` on the deployed private beta.
- The source was inferred as a launch-prep SaaS with accounts and stored data; the scan completed successfully with a 62/100 readiness score and five static findings.
- The result rendered source evidence, ranked findings, verification routes, deterministic report handoff, trusted framework guidance, and the setup-pack preview.
- The scan did not execute the scanned repository's code.

## Known Environment Limits

- OpenAI enhancement remains optional; deterministic fallback behavior is covered by mocked tests.
- The deployed environment reports that GitHub OAuth is not configured, so private-repository scanning and issue creation remain unverified deployment capabilities.
- Vibe's self-scan still identifies optional or operational work (error tracking, analytics, and an AI workspace rules file) plus reviewable request-protection signals. These are static findings, not a claim that the deployment is broken.

## Release Verdict

Vibe is ready to present as a deployed private beta: public GitHub/ZIP scanning, Google invite gating, per-user ownership, quotas, retention, scan comparison, and health checks are implemented. It is not marketed as an unrestricted multi-tenant SaaS; teams, billing, background jobs, and broad provider integrations remain intentionally out of scope.
