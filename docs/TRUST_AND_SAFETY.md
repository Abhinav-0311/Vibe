# Trust And Safety

Vibe is a static readiness scanner. It is designed to inspect project files without executing the project being scanned.

## What Vibe Reads

- Repository file names and selected source files needed for static checks
- Package metadata, lockfiles, framework config, route files, and middleware files
- Test, analytics, observability, deployment, and AI workspace signals
- GitHub repository archives when a user starts a GitHub scan
- Uploaded ZIP archives when a user starts an upload scan

## What Vibe Does Not Do

- It does not run `npm install`.
- It does not run package lifecycle scripts.
- It does not run tests, builds, migrations, or app servers from the scanned project.
- It does not execute scanned application code.
- It does not create GitHub issues without an explicit user action.
- It does not use AI enhancement unless `OPENAI_REPORT_ENABLED=true`.

## Secrets

Vibe may detect environment files by filename and ignore-rule coverage, but reports should not print secret values. Treat every uploaded project as sensitive and keep logs free of tokens, database URLs, API keys, OAuth secrets, and archive contents.

## Hosted Deployments

Hosted deployments should use GitHub or ZIP scanning. Local workspace scanning is intended only for trusted local or self-hosted use and should stay disabled on Vercel.

## Uploaded ZIP Files

ZIP uploads are size-limited, path-validated, extracted to a temporary folder, scanned, and removed after the request finishes. Future SaaS versions should add user accounts, quotas, retention controls, and deletion guarantees before accepting sensitive commercial repositories.

## GitHub Access

Public repository scans use downloadable repository archives. Private repository scans require OAuth. GitHub issue creation is a separate explicit action from scanning.
