# MVP QA Report

Local verification date: 2026-10-08. These results cover this changeset, including the pressure-test fixes. Earlier browser/deployment observations below are historical and were not repeated for this changeset; local results do not prove the deployed version contains these fixes. CI and deployment status are checked separately for each release.

## Automated Gates

- ESLint 9: passed with no warnings or errors
- Vitest: 233 tests across 31 executed test files passed
- Next.js production build: passed
- TypeScript validation: passed through the production build and standalone `tsc --noEmit`
- Prisma schema validation: passed; no migrations or database mutations were run
- Token-pattern hygiene check: no matching GitHub/OpenAI token pattern in tracked source/documentation or the new untracked tests; this is not a complete secret audit
- `git diff --check`: passed
- Coverage percentage: not measured; no coverage provider is installed, and no packages were installed for this verification

This validation reflects the current private-beta checkout, including scanner calibration fixtures, per-user beta controls, source-fingerprint caching, and comparable re-scan verification guidance.

## Pressure-Test Fixes (2026-10-08, Locally Verified)

- Corrupt archive headers and checksums produce a safe validation error, not a generic server failure. Genuine filesystem failures remain server errors. ZIP path validation handles both slash styles on Windows and Linux. Invalid extraction and failed scan processing remove temporary directories.
- GitHub archive reads own their stream reader: timeouts cancel without a locked-stream rejection, release the lock, and permit a later retry. The 25 MB limit is enforced while streaming, including when `Content-Length` is absent.
- GitHub archives are downloaded at the resolved commit SHA, not a moving branch. Concurrent-download keys distinguish commits and case-sensitive branch names; the cache format version invalidates older branch-based results.
- Quota-store failures remain fail-closed and return `503 service_unavailable` with a 60-second `Retry-After` on local, ZIP, and GitHub scan routes. Actual daily-quota exhaustion remains `429 quota_exceeded`. Outage logs contain only the event name and status.
- Mocked recovery tests cover GitHub rate-limit cooldown/recovery, request deadlines, AI network failures and malformed output, quota reset/recovery, cache read failures, and unsuccessful database writes.
- Testing required no new dependencies, migrations, real account deletions, or production data writes.

## Bounded Local Concurrency

The harness in `tests/scan-concurrency.test.ts` exercises ZIP extraction, static analysis, profile inference, scoring, report/setup-pack generation, and cleanup. It uses small synthetic Next.js, Vite React, and Express fixtures. Persistence is mocked; AI enhancement is disabled; a fetch spy verifies no network requests occur.

One focused local run on 2026-10-08 produced:

| Concurrent jobs | Completed | Batch elapsed | Per-job p50 | Per-job p95 |
| --- | --- | --- | --- | --- |
| 1 | 1 | 53 ms | 44 ms | 44 ms |
| 5 | 5 | 144 ms | 124 ms | 130 ms |
| 10 | 10 | 260 ms | 230 ms | 236 ms |
| 20 | 20 | 509 ms | 455 ms | 465 ms |

Per-job timings cover extraction through report generation and test assertions, excluding cleanup; batch elapsed includes cleanup. There is a three-fixture warm-up before each measured batch. These measurements are diagnostic and machine-dependent, not latency guarantees or Vercel/database capacity estimates.

- Concurrent results matched each fixture's baseline scan fingerprint, and each job used a unique extraction directory.
- Each scan passed its own test user ID to mocked persistence; this is not a real database/account-isolation load test.
- A separate 20-job mixed batch completed 15 valid scans and rejected five corrupt uploads without affecting the valid jobs; all 20 temporary directories were removed.
- Memory usage, long-duration soak behavior, large-repository performance, and hosted/database concurrency were not measured.

Reproduce the bounded local measurements:

```powershell
npm.cmd test -- tests/scan-concurrency.test.ts --reporter=verbose --silent=false
```

## Earlier Correctness Fixes (2026-10-03)

- Account deletion expires the current browser's GitHub connection and pending OAuth cookies after database deletion succeeds.
- Confirmed deletion clears the account's browser scan history and triage keys, stops local persistence, and rejects late scan/restore results. Other accounts' browser data is preserved.
- Cleanup/sign-out failures no longer falsely claim that nothing was deleted. A missing server response is treated as an unknown outcome, not proof of failure.
- Monorepo app paths isolate comparisons, finding triage, and browser history. Direct comparisons also require the same target/profile and an earlier baseline.
- Added mocked route and cleanup regression tests; no real account was deleted for testing.
- Fresh Google login, copy/export, actual fix/re-scan, and deletion with a disposable account still need browser acceptance. Browser automation could not connect during this verification run.
- These changes are locally verified. Post-push CI, deployment status, and fresh browser acceptance are separate release checks.

## Current Verification Commands

```powershell
npm.cmd test
npm.cmd run lint
npm.cmd run build
npx.cmd --no-install tsc --noEmit
npx.cmd --no-install prisma validate
```

## Historical Local Browser Smoke Test

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

## Historical Production Smoke Test

Environment: Vercel production deployment at `https://vibe-seven-snowy.vercel.app`.

- The deployed private beta returned HTTP 200 from `/api/health` with application `ok` and database `ok`.
- Production database migrations were applied to Neon PostgreSQL.
- Hosted deployment uses GitHub and ZIP scanning; local workspace scanning is disabled for Vercel.
- Public GitHub and ZIP scans use durable PostgreSQL-backed enforcement in addition to per-user beta scan quotas.

## Previous Deployed Browser Smoke Test (2026-09-16)

Environment: Vercel production deployment, verified with Playwright browser automation.

- An authenticated browser session completed a public GitHub scan of `Abhinav-0311/Vibe` on the deployed private beta.
- The source was inferred as a launch-prep SaaS with accounts and stored data; the scan completed successfully with a 62/100 readiness score and five static findings.
- The result rendered source evidence, ranked findings, verification routes, deterministic report handoff, trusted framework guidance, and the setup-pack preview.
- The scan did not execute the scanned repository's code.

## Known Environment Limits

- OpenAI enhancement remains optional; deterministic fallback behavior is covered by mocked tests.
- Earlier deployed observations reported that GitHub OAuth was not configured. Private-repository scanning and issue creation remain unverified for this changeset.
- Historical self-scan results identified optional or operational work (error tracking, analytics, and an AI workspace rules file) plus reviewable request-protection signals. They are not a current scan of these fixes or proof that the deployment is broken.

## Pending Release Checks

1. Confirm CI and the Vercel deployment succeed for the released commit. Local verification is not a substitute for these release gates.
2. Run fresh browser acceptance on the released version: Google sign-in, public GitHub/ZIP scan, evidence, copy/export, fix/re-scan, restore/history, mobile/keyboard use, account isolation, and deletion with a disposable account. Browser automation could not connect during the latest testing attempt.
3. Use a separate staging database and disposable accounts for bounded hosted/database load tests. The local harness bypasses HTTP/auth/quota enforcement and does not exercise real persistence or provider traffic.
4. Recheck deployed health and logs after release; do not treat earlier production observations as acceptance of the new changeset.

## Release Verdict

Local automated gates pass for this changeset, and bounded local concurrency produced stable results and complete cleanup. CI/deployment checks are tracked per release; fresh browser acceptance and staging/database load verification remain outstanding. Vibe can be presented as a deployed private beta with these limitations, not as a fully pressure-tested production service; teams, billing, background jobs, and broad provider integrations remain intentionally out of scope.
