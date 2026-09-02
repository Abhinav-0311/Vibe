# Future Roadmap

Vibe's current single-user MVP is ready for local portfolio demos and controlled deployment. The roadmap below separates publication-ready MVP work from future SaaS work.

## MVP Complete

- Static scanner for Node.js projects
- Local project scan, ZIP upload scan, and GitHub repository scan
- Nested app-root detection for GitHub and ZIP scans
- Framework detection for Next.js, Vite React, Vite, Create React App, Remix, Astro, SvelteKit, Nuxt, Express, and NestJS
- Context-aware launch-readiness checklist
- UI/UX, security, reliability, launch basics, and AI workspace scoring
- Evidence-backed findings with learning notes and copyable prompts
- AI workspace setup-pack preview and ZIP export
- PostgreSQL scan archive, deduplication, restore, and health visibility
- Google private-beta sign-in, invite gating, per-user scan ownership, and quotas
- Comparable re-scan progress, durable readiness trends, and PR-ready handoff briefs
- Optional evidence-grounded OpenAI FixPlans with strict schema validation, deterministic fallback, token/cost metadata, and regression coverage
- Versioned Next.js guidance with official source links, verification routes, and private-beta feedback
- README, QA report, deployment notes, portfolio case study, and private-beta runbook

## Publication Polish

- Add README screenshots or a short GIF for the main workflow
- Record a 60 to 90 second demo video
- Add a public landing page that explains the product without exposing unrestricted scanning
- Run a final manual responsive visual QA pass
- Test the private GitHub OAuth path with a real OAuth app before demoing private repositories

## Hosted Product Work

- Team workspaces and role boundaries
- Billing and plan limits
- Background scan jobs for large repositories
- Durable object storage for uploaded archives if async processing is added
- Audit logs for GitHub actions and issue creation

## Scanner Expansion

- Better UI/UX heuristics for forms, navigation, empty states, and responsive layouts
- Deeper deployment checks for Vercel, Render, Railway, and Fly.io
- More framework support beyond Node.js projects
- Optional advanced implementation workflow for grouped fix queues, branch handoff, and re-scan comparison
- Framework-specific rule packs for Django, Laravel, FastAPI, Rails, and mobile apps
- Dependency vulnerability and license-surface reporting

## AI Capabilities

- Workspace-specific remediation templates
- Safer multi-step fix planning with user approval checkpoints
- Optional model comparison for prompt quality once a real evaluation corpus exists
- Evaluation harness for generated prompts and setup-pack quality after beta users provide feedback

## Enterprise Readiness

- Organization-level policy packs
- SSO
- Role-based access control
- Private networking options
- Compliance exports
- Scheduled scans and trend history
