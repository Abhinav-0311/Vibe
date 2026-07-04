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
- Optional OpenAI report enhancement with deterministic fallback
- README, QA report, deployment notes, portfolio case study, and demo script

## Publication Polish

- Add README screenshots or a short GIF for the main workflow
- Record a 60 to 90 second demo video
- Add a public landing page that explains the product without exposing unrestricted scanning
- Run a final manual responsive visual QA pass
- Test the private GitHub OAuth path with a real OAuth app before demoing private repositories

## Hosted Product Work

- User authentication
- Tenant isolation and team workspaces
- Hosted scan quotas and abuse controls
- Billing and plan limits
- Background scan jobs for large repositories
- Durable object storage for uploaded archives if async processing is added
- Audit logs for GitHub actions, issue creation, branch creation, and draft PR creation

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
- Optional model comparison for prompt quality
- Evaluation harness for generated prompts and setup-pack quality
- More explicit cost and token reporting for AI-enhanced reports

## Enterprise Readiness

- Organization-level policy packs
- SSO
- Role-based access control
- Private networking options
- Compliance exports
- Scheduled scans and trend history
