# AGENTS.md

## Product

Vibe is a launch-readiness auditor for AI-built apps. It scans a project, detects production-readiness signals, runs context-aware checklist rules, and turns findings into actionable fix prompts.

## Current Stack

- Next.js
- TypeScript
- Tailwind CSS
- Vitest
- Local scanner and checklist engine

## Build Principles

- Scanner facts come before AI reasoning.
- Checklist findings must cite evidence.
- Do not execute scanned project code.
- Keep the first supported stack narrow: Next.js SaaS apps.
- Prefer clear product behavior over broad framework support.

## Design Rules

- Use the parent project design constraints: Emil Kowalski, Impeccable Taste, Elite Product Designer.
- Keep the interface quiet, sparse, and premium.
- Use black canvas, restrained surfaces, strong typography, and one accent color.
- Every UI workflow needs empty, loading, error, hover, and focus states.

## Mentoring Mode

When working on this project, explain:

- what is being built
- why it matters
- which files are involved
- what can break
- how to verify the result

The goal is to help the builder understand and explain the system, not just finish code.

## Safety Boundaries

- Do not store real API keys in source files.
- Do not run untrusted repo scripts as part of scanning.
- Do not add broad framework support until the Next.js scanner is useful.
- Do not auto-fix user code until audit quality is reliable.
