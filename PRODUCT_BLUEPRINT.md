# Vibe Product Blueprint

## Lead Manager Summary

Vibe should be built as a narrow, high-trust launch readiness scanner for AI-built web apps. The sharp wedge is not "AI that teaches coding"; it is "code-aware production readiness for apps built too quickly."

The product wins only if recommendations are specific to the user's repo. Generic advice like "add rate limiting" is not enough. A useful finding should say where the risk exists, why it matters, how severe it is, and what exact prompt or task should be used to fix it.

## Target User

Primary users:

- Vibe coders launching SaaS apps
- New developers building portfolio or startup projects
- Indie hackers shipping quickly
- Bootcamp students
- Small business operators trying to configure AI coding or business agents

Secondary users:

- Agencies doing pre-handoff audits
- Coding schools using readiness scores as a grading layer
- AI automation consultants setting up Claude Code, Codex, Cursor, or MCP-based workflows

## Core Promise

Vibe helps builders move from:

> It works on my laptop.

to:

> This is safe enough to put in front of real users.

## Product Modules

### 1. Repo Scanner

Detects:

- Framework and package manager
- Next.js app router or pages router
- API routes and server actions
- Auth provider signals
- Stripe/payment files
- Environment variable usage
- Database schema signals
- Test setup
- Deployment config
- Analytics and error tracking libraries

### 2. Production Checklist Engine

Runs categorized checks:

- Auth and user safety
- Security
- Payments
- Data and reliability
- Analytics
- User feedback
- Launch basics
- Testing
- Deployment
- Market basics

### 3. Architecture Stress Test

Status: complete for the MVP. Results are deterministic and limited to repository evidence.

Turns the original prompt pack into automated audits:

- Schema stress test
- Security blind spot audit
- Vendor lock-in and migration audit
- Cost explosion simulation
- Failure mode simulation
- Completion versus stability check

### 4. AI Report Generator

Generates:

- Readiness score
- Critical blockers
- High, medium, and low findings
- Evidence from the project
- Why each issue matters
- Exact implementation prompts
- Optional GitHub issue text

### 5. Fix Assistant

Status: complete for the current single-user product scope.

Current behavior:

- Copy-paste prompts for Cursor, Codex, Replit, or Copilot
- Deterministic Markdown implementation plans ordered by finding severity
- GitHub issue creation after explicit user approval
- Dedicated GitHub fix-branch creation after explicit user approval
- Draft pull-request creation after users push implementation commits
- Re-scan comparison across the same project and audit context

Safety boundary:

- Vibe does not edit repository code, create implementation commits, or claim a finding is fixed.
- A finding is considered resolved only when a comparable re-scan no longer detects it.
- Uploaded ZIP projects require a fresh upload because Vibe cannot safely infer local changes.

### 6. AI Workspace Readiness

Status: complete for the MVP setup-pack scope.

Audits whether the builder's AI environment has enough context to operate consistently.

This module is based on the idea that installing an AI coding tool is not enough. A useful AI workspace needs layers:

- Rules file: brand voice, pricing, project standards, boundaries, and operating constraints.
- Memory files: persistent facts about the business, product, users, decisions, and current roadmap.
- Session start hook: a startup routine that summarizes recent work, trackers, priorities, and open tasks before coding begins.
- MCP servers: real tool access for browser, files, desktop, GitHub, docs, and other operational surfaces.
- API wiring: controlled access to business systems such as email, calendar, store, CRM, analytics, or support tools.

MVP version:

- Detect project instruction files such as `AGENTS.md`, `.cursor/rules`, `.cursorrules`, Claude/Codex notes, README setup sections, and automation checklists.
- Flag missing AI context files.
- Recommend a minimal rules file.
- Recommend memory file structure.
- Generate copy-paste prompts to create or improve AI operating context.

Later version:

- Generate full agent setup checklist.
- Validate MCP configuration.
- Validate API integration plan.
- Produce a business automation readiness report.
- Offer remote setup workflows for consultants or agencies.

## MVP Product Flow

1. User lands on the dashboard.
2. User creates a project.
3. User uploads a zipped repo or points Vibe to a local sample path during development.
4. User answers:
   - What type of app is this?
   - Do users log in?
   - Do users pay?
   - Is user data stored?
   - Where will this be deployed?
   - Is this project assisted by Cursor, Codex, Claude Code, or another AI coding tool?
5. Vibe runs scanner jobs.
6. Vibe checks app readiness and AI-workspace readiness.
7. User sees a readiness report.
7. User opens each finding and copies the fix prompt.

## Design Direction

The interface should feel like a serious audit workspace, not a colorful AI toy.

Design principles:

- Quiet, premium, sparse
- Strong typography and rhythm
- Severity shown through restraint, not noise
- Clear scan status and result hierarchy
- Findings optimized for action
- No decorative clutter

Primary screen:

- Left: project and scan navigation
- Main: readiness score, critical blockers, categorized findings
- Right or lower detail panel: evidence, explanation, fix prompt

Every screen must include:

- Clear primary action
- Clear secondary action
- Empty state
- Loading state
- Error state
- Hover state
- Focus state

## Product Risks

### Risk 1: Generic AI Output

Mitigation: require evidence-based findings. Every finding should cite a file path, route, dependency, or missing signal whenever possible.

### Risk 2: Too Many Stacks

Mitigation: support Next.js SaaS first. Expand only when one stack is genuinely useful.

### Risk 3: False Confidence

Mitigation: use "readiness signals" language instead of claiming certification or guaranteed security.

### Risk 4: Unsafe Auto-Fixes

Mitigation: MVP produces prompts and issues, not automatic PRs.

### Risk 5: Becoming An Automation Agency Product Too Early

Mitigation: keep AI workspace readiness as an audit category first. Do not build Gmail, calendar, store, social, and desktop automation until the core repo scanner works.

## Success Criteria

The MVP is successful when a user can scan a Next.js project and receive at least 10 specific, categorized findings with actionable fix prompts in under 2 minutes.

AI workspace readiness is successful when the report can clearly say whether the project has durable operating context for AI tools, including rules, memory, boundaries, and setup guidance.

## Non-Goals For MVP

- Training a custom AI model
- Full multi-framework support
- Automatic production certification
- Deep exploit-level security review
- Automatic code modifications
- Enterprise team management
- Full business automation setup
- Direct Gmail, calendar, store, or social media API control
