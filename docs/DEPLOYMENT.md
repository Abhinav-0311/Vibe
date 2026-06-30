# Deployment And Recovery

## Release Contract

Vibe is currently a single-user MVP. A public deployment may scan uploaded ZIP archives and public GitHub repositories. Private GitHub access and OpenAI enhancement should be enabled only for a trusted deployment because multi-user authorization, tenant isolation, quotas, and billing are post-MVP.

## Required Services

- Node.js 22 runtime
- PostgreSQL 17 or a compatible managed PostgreSQL service
- Persistent deployment secrets
- HTTPS origin for production GitHub OAuth

## Required Environment

- `NEXT_PUBLIC_APP_URL`: canonical HTTPS deployment URL
- `DATABASE_URL`: managed PostgreSQL connection string
- `OPENAI_REPORT_ENABLED`: keep `false` unless the deployment is trusted
- `OPENAI_API_KEY`: required only when AI enhancement is enabled
- `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET`: required for private repositories
- `GITHUB_TOKEN_ENCRYPTION_KEY`: random secret containing at least 32 characters
- `VIBE_ENABLE_LOCAL_SCAN`: optional. Keep unset or `false` on Vercel. Use `true` only for trusted local/self-hosted environments.

## Vercel Readiness

Vercel deployments cannot scan a visitor's local filesystem. In hosted mode, Vibe should be used through:

- public GitHub repository scan
- connected private GitHub repository scan
- ZIP upload scan

Local workspace scanning is disabled by default when `VERCEL=1`. The dashboard hides the local source tab when the server reports local scanning is unavailable.

Recommended Vercel setup:

1. Create a managed PostgreSQL database.
2. Set `DATABASE_URL` to the managed database connection string.
3. Set `NEXT_PUBLIC_APP_URL` to the Vercel production URL.
4. Keep `VIBE_ENABLE_LOCAL_SCAN` unset or set it to `false`.
5. Keep `OPENAI_REPORT_ENABLED=false` unless the deployment is authenticated and trusted.
6. Configure GitHub OAuth only if private repository scanning or issue/PR actions are needed.
7. Run `npm.cmd run db:deploy` against the managed database before relying on saved scans.

## Deployment Sequence

1. Provision PostgreSQL and take a provider snapshot before migration changes.
2. Configure deployment secrets from `.env.example`; never upload the local `.env` file.
3. Run `npm ci` and `npm run db:generate`.
4. Run `npm run lint`, `npm test`, and `npm run build`.
5. Run `npm run db:deploy` against the target database.
6. Deploy the same verified commit.
7. Request `/api/health`; require HTTP 200 before directing traffic.
8. Run one public-repository scan and verify report, setup-pack export, and Fix Assistant output.

## GitHub OAuth

Set the production callback to:

```text
https://YOUR_DOMAIN/api/github/oauth/callback
```

The callback origin must match `NEXT_PUBLIC_APP_URL`.

## Rollback

1. Stop traffic to the failed release or restore the previous deployment artifact.
2. Do not automatically reverse a database migration.
3. Inspect the migration and restore the pre-deploy snapshot if data compatibility was broken.
4. Re-run `/api/health` and the public-repository smoke scan.
5. Record the failure, evidence, recovery action, and follow-up test before retrying.

## Operational Checks

- `/api/health` returns `503` when PostgreSQL is missing or unreachable.
- CI must pass tests and the production build for the deployed commit.
- Logs must not contain repository archives, OAuth tokens, encryption keys, database URLs, or OpenAI keys.
- Uploaded archives are temporary and must continue to be deleted after every success or failure path.
