# Limitations

Vibe is a launch-readiness assistant, not a security certification system.

## What Vibe Can Do

- Inspect repository files without executing scanned project code
- Detect common readiness signals from file structure, dependencies, routes, and config
- Explain likely production gaps with evidence-backed findings
- Generate implementation prompts grounded in detected repository facts
- Save and restore scan reports when PostgreSQL is connected
- Scan local projects in trusted local development, public GitHub repositories, private GitHub repositories with OAuth, and uploaded ZIP archives

## What Vibe Cannot Prove

- It cannot prove an application is secure.
- It cannot prove authentication, billing, or data handling is correct.
- It cannot detect every vulnerability or business-rule flaw.
- It cannot replace manual code review, penetration testing, legal review, or production observability.
- It cannot know runtime behavior that is not visible from static repository evidence.
- It cannot verify third-party service dashboards, secrets, billing plans, or production incidents.

## Static Analysis Limits

Vibe reads files and metadata. It does not execute scanned code. This is safer, but it means some findings are based on detectable signals rather than runtime truth.

Examples:

- A project may have rate limiting implemented outside the repository.
- A project may have observability configured in the hosting provider but not visible in code.
- A route may be protected by upstream infrastructure that the scanner cannot see.
- A test setup may exist in a non-standard location the scanner does not yet recognize.

## Hosted Deployment Limits

On Vercel or another hosted platform, Vibe cannot scan a user's local filesystem. Hosted deployments should use:

- GitHub repository scanning
- ZIP upload scanning
- managed PostgreSQL

Local workspace scanning is intended for trusted local development only and is disabled by default on Vercel.

## Current Framework Scope

The MVP is optimized for Node.js and Next.js projects. Other stacks may be uploaded or scanned, but results are not guaranteed to be useful until dedicated rule packs are added.

## AI Enhancement Limits

OpenAI enhancement is optional. The deterministic scanner and checklist remain the source of truth.

AI output may improve wording and implementation prompts, but it must not:

- change scores
- change severities
- remove evidence
- add invented files, routes, users, incidents, pricing, or business facts
- claim certification

If AI enhancement fails, Vibe preserves the deterministic report.

## Public Access Limits

Do not expose a public multi-user deployment without:

- authentication
- tenant isolation
- quotas
- abuse controls
- upload limits
- GitHub rate-limit handling
- billing or usage controls if scanning is expensive

The current project is publication-ready as a portfolio MVP, not as an unrestricted public SaaS.
