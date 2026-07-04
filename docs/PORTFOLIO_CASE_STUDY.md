# Vibe: AI-Built App Launch Readiness

## Problem

AI coding tools help new builders produce working interfaces quickly, but a local demo does not prove authentication safety, payment integrity, deployment repeatability, observability, or durable AI project context.

## Product

Vibe scans a local Node.js project, uploaded ZIP archive, or GitHub repository without executing project code. It converts repository facts into context-aware findings, a readiness report, an architecture stress test, and an AI workspace setup pack.

## AI Engineering Decisions

- Deterministic scanner and checklist rules remain the source of truth.
- Optional OpenAI output is schema-constrained and may improve only narrative and prompts.
- Model output cannot add findings, remove evidence, change severity, or alter the score.
- Every model failure falls back to the deterministic report.
- Generated AI workspace files mark unknown product facts as TODOs instead of inventing them.

## System Flow

```mermaid
flowchart LR
    A[Local folder, ZIP, or GitHub repo] --> B[Safe static scanner]
    B --> C[Deterministic checklist]
    C --> D[Architecture stress test]
    C --> E[Evidence-backed report]
    E --> F[Optional constrained AI enhancement]
    C --> G[AI workspace setup pack]
    E --> H[(PostgreSQL scan archive)]
```

## Safety Boundaries

- Scanned project code is never executed.
- Uploaded archives are size-limited, path-validated, extracted temporarily, and deleted.
- Local paths are restricted to the configured workspace root.
- OAuth tokens are encrypted before cookie storage.
- GitHub issue creation requires explicit user action.
- Vibe never edits repository code or claims production readiness beyond static evidence.

## Technical Stack

- Next.js 15 App Router, React 19, TypeScript, Tailwind CSS
- Next.js Route Handlers and Node.js static filesystem inspection
- PostgreSQL 17, Prisma 7, and Prisma PostgreSQL adapter
- GitHub OAuth 2.0 with PKCE and GitHub REST API
- Optional OpenAI structured output with deterministic fallback
- Vitest and GitHub Actions quality gates

## Demonstration Story

1. Scan a repository using launch-prep context.
2. Open a finding and inspect its exact evidence.
3. Copy the finding prompt or generated report.
4. Export the AI workspace setup pack.
5. Show saved scan history and PostgreSQL archive.

For a timed walkthrough, use [DEMO_SCRIPT.md](./DEMO_SCRIPT.md).

## Engineering Value Demonstrated

- Designing an AI feature around deterministic evidence rather than unrestricted generation
- Building secure repository ingestion and GitHub OAuth workflows
- Translating static code signals into contextual product risk
- Designing model fallbacks, trust boundaries, persistence, and measurable verification
- Delivering a full-stack product with tests, CI, deployment, and recovery documentation
