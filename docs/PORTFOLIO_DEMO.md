# Vibe Portfolio Demo

This is a 75 to 90 second recording script for Vibe. Record only screens and outcomes you can reproduce in the current deployed build.

## Before recording

1. Deploy the current commit and apply the pending `GuidanceFeedback` migration with `npm run db:deploy` against the intended production database.
2. Sign in with an invited Google account.
3. Use a safe public repository or Vibe itself; never display `.env` values, OAuth tokens, or database URLs.
4. Prepare one clear scan result with a finding, and optionally a comparable re-scan.

## Voiceover script

**0–12 seconds — problem**

“AI tools can produce a working interface quickly, but that does not prove the app is safe or ready to launch. Vibe turns static repository evidence into a practical launch-readiness review.”

**12–28 seconds — safe scan**

“I can scan a public GitHub repository or a ZIP without running its code. Vibe inventories framework, routes, dependencies, environment safety, testing, and deployment signals.”

**28–45 seconds — evidence before AI**

“The readiness score comes from deterministic rules. Each finding shows the exact evidence, impact, suggested fix, and verification route, so this is not a generic AI opinion.”

**45–60 seconds — bounded AI**

“When enabled, the model produces a structured FixPlan only after the deterministic scan. It cannot change the score or invent findings; an invalid response falls back to the evidence-generated report.”

**60–75 seconds — useful handoff**

“For Next.js projects, Vibe also selects reviewed guidance with an official source and a way to verify the change. Users can give a small helpfulness signal, and GitHub handoff stays explicit and user-approved.”

**75–90 seconds — close**

“The result is an evidence-first AI engineering workflow: scan, understand, fix, and verify with a comparable re-scan.”

## Capture checklist

- Scan source and readiness profile
- One finding expanded to show evidence and verification
- Generated report, not secret configuration
- One trusted Next.js guidance card and its source link
- Comparable re-scan or saved-scan history
- Optional GitHub handoff preview; do not create a real issue for the video unless you intend to keep it

## Claims that are safe to make

- “30 deterministic readiness rules.”
- “116 passing automated tests in the validated local checkout.”
- “The optional AI layer is schema-validated and evidence-grounded.”
- “Vibe never executes scanned repository code.”

Do not claim broad benchmark accuracy, autonomous code fixing, real-user adoption, or production-scale observability without new evidence.
