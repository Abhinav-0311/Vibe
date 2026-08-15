# Private beta runbook

Vibe now uses Google only for Vibe identity. GitHub OAuth remains a separate, optional repository connection and is bound to the signed-in Vibe user.

## Before the first deployment

Set these Vercel environment variables for Production and Preview without exposing their values in source control:

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `NEXTAUTH_URL` set to the exact deployed URL
- `NEXTAUTH_SECRET` set to a random secret of at least 32 bytes
- `VIBE_BETA_DAILY_SCAN_LIMIT` (optional; defaults to 20)

Then apply the database migration with the production `DATABASE_URL` available only in your own terminal:

```powershell
cd E:\College\Project\Vibe
$env:DATABASE_URL = "<your Vercel Production DATABASE_URL>"
npm run db:deploy
```

The migration preserves pre-beta anonymous scan records but intentionally makes them unavailable to signed-in users. New saved scans are scoped to their owner.

## Invite a beta user

In Neon SQL Editor, insert the exact lower-case Google email address that the tester will use:

```sql
INSERT INTO "BetaInvite" ("email", "note", "updatedAt")
VALUES ('tester@example.com', 'Private beta', NOW())
ON CONFLICT ("email") DO UPDATE
SET "active" = true, "note" = EXCLUDED."note", "updatedAt" = NOW();
```

To remove access without deleting audit data:

```sql
UPDATE "BetaInvite" SET "active" = false, "updatedAt" = NOW()
WHERE "email" = 'tester@example.com';
```

## Verify after deployment

1. Open the deployment in a private browser window: the private-beta sign-in screen should appear.
2. Sign in with an email not listed in `BetaInvite`: access must be denied.
3. Add your email to `BetaInvite`, sign in again, and run one ZIP or GitHub scan.
4. Confirm the scan appears only in that account's saved scan list.
5. Sign out, then confirm `/api/scans` returns `401` and GitHub cannot be connected.

Do not put Google credentials, database URLs, or invite emails in Git.
