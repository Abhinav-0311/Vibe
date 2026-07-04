# Vercel Deployment

Vibe can run on Vercel as a hosted scanner for GitHub repositories and ZIP uploads. Local folder scanning is intentionally disabled in hosted mode because a deployed server cannot read a visitor's machine.

## Production Mode

Use these scan sources in production:

- GitHub repository scan for public repositories
- GitHub OAuth scan for private repositories
- ZIP upload scan for projects that should not be connected through GitHub

Do not enable local workspace scanning on Vercel.

## Environment Variables

Set these in Vercel project settings:

```env
NEXT_PUBLIC_APP_URL=https://YOUR_DOMAIN
DATABASE_URL=postgresql://USER:PASSWORD@HOST:PORT/DATABASE?schema=public
VIBE_ENABLE_LOCAL_SCAN=false
OPENAI_REPORT_ENABLED=false
OPENAI_API_KEY=
OPENAI_REPORT_MODEL=gpt-5.4-mini
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
GITHUB_TOKEN_ENCRYPTION_KEY=
SENTRY_DSN=
```

Required for a basic public launch:

- `NEXT_PUBLIC_APP_URL`
- `DATABASE_URL`
- `VIBE_ENABLE_LOCAL_SCAN=false`

Set `DATABASE_URL` before the first Vercel deployment. The build can generate Prisma Client without it, but saved scans and `/api/health` require a real managed PostgreSQL connection.

Required only for private GitHub repositories:

- `GITHUB_CLIENT_ID`
- `GITHUB_CLIENT_SECRET`
- `GITHUB_TOKEN_ENCRYPTION_KEY`

Required only for AI-enhanced wording:

- `OPENAI_REPORT_ENABLED=true`
- `OPENAI_API_KEY`
- `OPENAI_REPORT_MODEL`

Keep AI enhancement disabled until the deployment has authentication, quota controls, and cost monitoring.

## Database

Use a managed PostgreSQL provider such as Neon, Supabase, Railway, or Vercel Postgres. After setting `DATABASE_URL`, run migrations against the production database:

```powershell
npm.cmd run db:deploy
```

The health endpoint returns `503` when the database is configured but unreachable:

```text
https://YOUR_DOMAIN/api/health
```

## GitHub OAuth

For private repository scans, create a GitHub OAuth app and set the callback URL to:

```text
https://YOUR_DOMAIN/api/github/oauth/callback
```

The callback origin must match `NEXT_PUBLIC_APP_URL`.

## Launch Smoke Test

After deploying, verify:

1. `/api/health` returns HTTP 200.
2. The scan input shows GitHub and ZIP as the primary source options.
3. A public repository scan completes.
4. A ZIP upload scan completes and does not persist extracted files.
5. The report shows score breakdown, findings, learning notes, and copyable prompts.
6. Saved scans appear after refreshing the page.

## Vercel Constraints

- Local folder scanning is unavailable in hosted mode.
- ZIP uploads are temporary and size-limited.
- Scans are static; Vibe does not run install scripts, tests, builds, migrations, or app code from scanned projects.
- Long-running scans may need a background job queue in the future if repository size grows beyond serverless request limits.
