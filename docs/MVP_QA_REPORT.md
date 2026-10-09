# MVP QA Report

Baseline hosted release checked: `20e0e93031f3aa8278dacb88b0f0a07b6d5652f1`. Closeout changes and full local verification: 2026-10-09. Hosted acceptance: 2026-10-08/09. The current checks below supersede the historical browser limitations recorded later in this report. Local tests, CI, deployed smoke checks, and unverified operating limits are listed separately.

Closeout code release: `3d13d7510cc7a08e9c6d0bc865cc93e6b967c93d`. GitHub Quality [37923311183](https://github.com/Abhinav-0311/Vibe/actions/runs/37923311183) passed, including the new PostgreSQL service and HTTP tests. Vercel deployment `dpl_82Bw1S6CdU3b13gfd2Lg3goivck9` reached Ready and owns the production alias. On that deployment, application/database health passed, a public self-scan completed at 62/100, and restoring the earlier ZIP report returned 83/100 with the stale success notice cleared. Browser warning/error logs were empty; the deployment-scoped recent warning/error/fatal query returned no records. These observations are bounded checks, not a guarantee of zero future failures.

## Automated Gates

- ESLint 9: passed with no warnings or errors
- Vitest: 243 tests across 33 executed test files passed, with the disposable database suite enabled
- Next.js production build: passed
- TypeScript validation: passed through the production build and standalone `tsc --noEmit`
- Prisma schema validation: passed; all nine existing migrations were applied only to a new disposable local test database, not production
- Token-pattern hygiene check: no matching GitHub/OpenAI token pattern in tracked source/documentation or the new untracked tests; this is not a complete secret audit
- `git diff --check`: passed
- Coverage percentage: not measured; no coverage provider is installed, and no packages were installed for this verification

This validation reflects the current private-beta checkout, including scanner calibration fixtures, per-user beta controls, source-fingerprint caching, and comparable re-scan verification guidance.

## Hosted Release Acceptance (2026-10-08/09)

- GitHub Quality workflow [37758395654](https://github.com/Abhinav-0311/Vibe/actions/runs/37758395654) passed for `20e0e93` using Node.js 22. Vercel production deployment `dpl_89tKpKBeT212zB7Lt9MpDRauuahG` is Ready at [the private beta](https://vibe-seven-snowy.vercel.app/); its observed runtime is Node.js 24.x.
- An already-authenticated session completed a public scan of `Abhinav-0311/Vibe`: 62/100, five findings, zero critical and two high. Evidence, finding detail, prompt/report copy, and setup-pack export were exercised. The downloaded ZIP contained seven non-empty, safely named files.
- Refreshing the PostgreSQL archive and restoring the self-scan returned the saved report. This exercised persistence/restore, not cross-account isolation.
- Viewports at 375, 768, and 1440 pixels showed no horizontal page overflow. The keyboard skip link reached scan controls. These are smoke checks, not a full accessibility or Core Web Vitals audit.
- `/api/health` returned application `ok` and database `ok` again on 2026-10-09. During the ZIP check, browser warning/error logs were empty. Five recent Vercel records labelled `error` contained PostgreSQL SSL-mode compatibility warnings, not confirmed application failures. The closeout patch makes existing pg 8 certificate verification explicit with `verify-full`; seven regression cases cover alias normalization and unchanged explicit/local configurations.
- Fresh Vibe sign-out showed the private-beta gate; signing back in through Google's existing account chooser returned to the dashboard on 2026-10-09. No password, permissions, or beta invitations were changed.
- The signed-in empty dashboard had one main landmark, one H1, English document language, labelled visible inputs, no unnamed visible buttons, and no images missing alt attributes. Browser warning/error logs were empty. This is a focused DOM/browser smoke check, not WCAG certification or a Core Web Vitals measurement.

### ZIP → fix → re-scan (2026-10-09)

Two dependency-free synthetic project archives used the same filename, package name, and archive root. The selected profile stayed manual `launch-prep / content-site`, with accounts, payments, and stored data disabled. The only change was adding an npm lockfile.

| Check | Baseline | After lockfile |
| --- | --- | --- |
| App readiness | 76/100 | 83/100 |
| Findings | 5 | 4 |
| Missing lockfile | Detected | No longer detected |

- The hosted comparison showed **+7 points**, one evidence-cleared finding (`missing-lockfile`), zero new findings, and four still open. It explicitly said evidence clearance is not runtime certification.
- Both results appeared in the server-saved PostgreSQL archive. The corrected result was restored after refreshing the archive.
- A separate local assert-based check exercised actual ZIP extraction, scanning, scoring, comparison, and extraction cleanup, with the same 76 → 83 result. It did not use HTTP, authentication, persistence, or AI.
- Focused regression verification passed 35 tests across `scan-archive-errors`, `scan-database-recovery`, and `scan-history`. The first sandboxed attempt could not start tests because of temporary-file permissions; the successful retry ran outside that restriction.
- Initial upload attempts with unavailable temporary fixtures failed; persistent local fixtures completed both uploads. No application fix was required. No fixture code, dependency installation, build, or test command was executed from the uploaded project. This checks static signal clearance, not a real dependency installation or deployment.

Reproduce the focused regression checks:

```powershell
npm.cmd test -- tests/scan-archive-errors.test.ts tests/scan-database-recovery.test.ts tests/scan-history.test.ts
```

### Monitoring check (2026-10-09)

`lib/observability/server.ts` emits low-cardinality `vibe.*` errors to runtime logs. The deployed project has no configured Vercel drain; no application error-tracker integration was found in source or matching deployed environment-variable names. The account's Observability → Alerts page requires **Upgrade to Pro**. The owner explicitly chose **skip this** for alert setup. No plan upgrade, new service, or intentional production failure was introduced. Notification delivery remains unconfigured, not passed; failures may be missed without manual log review.

## Real PostgreSQL / HTTP Acceptance (2026-10-09)

`tests/database-http.test.ts` starts the production Next.js build on a random loopback port and uses real PostgreSQL, NextAuth database sessions, and disposable synthetic users. It refuses non-loopback URLs or any database name other than `vibe_closeout_test`. Test users and uploaded ZIPs never reach Google, GitHub, an AI provider, or production. These checks are now part of CI with a PostgreSQL service.

- An unauthenticated scan-history request returned 401. Two users uploaded ZIPs through real HTTP handlers; each saw only their own persisted scan, finding feedback, guidance feedback, and quota counter. Own-report restore returned 200; cross-user restore returned 404.
- Deleting one disposable account through `DELETE /api/account` removed its invite and user. Accounts, sessions, saved scans, quota usage, and both feedback tables cascaded to zero for that user while the other user's records remained. The deleted session then returned 401; the retained account still returned 200.
- A bounded burst of 20 concurrent uploads produced four 200 responses and 16 rate-limit 429 responses with `Retry-After`; all accepted reports were saved with identical scores. Atomic quota usage recorded all 20 attempts, and the next request returned `quota_exceeded`. One focused run took 303 ms for the burst plus quota assertions; machine-dependent, not a production latency promise.
- A stale success announcement observed when restoring a different saved scan was cleared at both history-selection and server-restore boundaries. The report itself was correct; only the previous scan's success text was stale.
- The suite exercises the actual HTTP/database deletion path, not live Google OAuth account deletion or the browser's destructive confirmation/cleanup interaction. The owner's real account was not deleted.

Reproduce only against an isolated local database, after applying the existing migrations and building the app:

```powershell
$env:VIBE_TEST_DATABASE_URL = 'postgresql://postgres@127.0.0.1:55439/vibe_closeout_test'
npm.cmd test -- tests/database-http.test.ts tests/prisma.test.ts --reporter=verbose --silent=false
```

Use the connection string for your disposable test database; the example port is not a persistent project service. Without this variable, the three HTTP cases are skipped. No production migration or new dependency is required by the closeout patch.

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
- At that verification run, browser automation could not connect. Copy/export and actual fix/re-scan were subsequently exercised in the hosted release checks above; fresh Google login and deletion with a disposable account remain unverified.
- The current-release section above records subsequent CI/deployment and bounded browser acceptance separately from these local regression checks.

## Current Verification Commands

```powershell
npm.cmd run lint
npm.cmd run build
npm.cmd test
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
- The hosted UI reported GitHub OAuth was not configured during this release check. Private-repository scanning and issue creation remain unverified.
- Self-scan recommendations include operational or optional work. Static findings and a healthy endpoint neither prove complete production readiness nor establish a runtime failure.

## Closeout Checklist (2026-10-09)

| Item | Status and boundary |
| --- | --- |
| 1. Error notifications | **Owner-skipped.** Logs remain available; no destination or delivery test. |
| 2. Fresh Google login/logout | **Passed on production.** Existing invited account signed out and back in. |
| 3. Account isolation | **Passed locally with real HTTP/PostgreSQL.** Two synthetic database-session users; not two live Google accounts. |
| 4. Account deletion | **Passed locally with real HTTP/PostgreSQL.** Cascades and session revocation verified. Live destructive browser acceptance needs an explicitly approved disposable invited account. |
| 5. Load enforcement | **Passed locally.** Twenty concurrent HTTP uploads exercised persistence, quota and rate limits. Hosted capacity/soak tests remain deferred; no replacement staging project or production load test. |
| 6. Private GitHub / issues | **Optional, not configured in hosted UI; unverified.** No credentials or permissions added. Public GitHub scanning passed. |
| 7. Live AI enhancement | **Optional, unverified.** No provider key or external source transmission added; deterministic fallback and mocked failure cases remain covered. |
| 8. Accessibility / performance | **Focused smoke checks passed.** Labels, landmarks, keyboard skip, responsive overflow checked. Full WCAG/Core Web Vitals audit not performed; no auditor installed. |
| 9. PostgreSQL SSL compatibility | **Fixed, tested, deployed.** Strict pg 8 verification made explicit without changing secrets; application/database health passed on the patch. |
| 10. Release handoff | **Passed for code release `3d13d75`.** Commit pushed, CI green, Vercel Ready, relevant production smoke checks passed. Local test container and ephemeral test data removed; no new dependency or production migration. |

## Release Verdict

All 243 local cases passed, including real HTTP/database isolation, deletion, and bounded concurrency. Closeout code release `3d13d75` passed CI and was verified on production; the earlier hosted scan/fix/re-scan and fresh Google sign-in/out checks are recorded separately above. Owner-skipped alerts and the explicitly unverified boundaries in the single checklist above remain limits, not hidden completion claims. Vibe is suitable to present as a deployed private beta, not as a fully capacity-tested public production service. Keep access invite-only; teams, billing, background jobs, and broad provider integrations remain out of scope.
