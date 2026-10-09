# Accounts And Access

Vibe uses Google for identity. Any verified Google account can sign in; no invitation or approval record is required. GitHub OAuth remains a separate, optional repository connection bound to the signed-in Vibe user.

## Before the first deployment

Set these Vercel environment variables for Production and Preview without exposing their values in source control:

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `NEXTAUTH_URL` set to the exact deployed URL
- `NEXTAUTH_SECRET` set to a random secret of at least 32 bytes
- `VIBE_DAILY_SCAN_LIMIT` (optional; defaults to 20 attempts per UTC day)

Then apply the database migration with the production `DATABASE_URL` available only in your own terminal:

```powershell
cd E:\College\Project\Vibe
$env:DATABASE_URL = "<your Vercel Production DATABASE_URL>"
npm run db:deploy
```

Existing migrations preserve historical anonymous scan records but intentionally make them unavailable to signed-in users. New saved scans are scoped to their owner. Removing the invitation requirement needs no new migration and does not expose another account's records.

## Google OAuth Audience

The application no longer checks an invitation list. Google's OAuth configuration is a separate boundary: confirm the consent app's audience permits the intended public users, rather than only configured test users or one organization. In Google Auth Platform, review **Audience** and publishing status. Keep the existing basic identity scopes; do not add Drive, Gmail, or other permissions. The production redirect must match `https://YOUR_DOMAIN/api/auth/callback/google` exactly.

If Google still reports that a user is not an approved tester, changing Vibe's database will not fix it; the Google Cloud app owner must change the OAuth audience/publishing settings. No Google Cloud configuration is changed by this code release.

## Limits And Deletion

Scan attempts, including failed or rate-limited attempts, count against the UTC-day quota. Per-address rate limits apply separately. The legacy `VIBE_BETA_DAILY_SCAN_LIMIT` deployment variable remains a fallback until the owner replaces it; the current variable takes precedence.

Account deletion removes saved scans, feedback, quota usage, and sessions through database cascades, plus any historical enrollment row. The historical `BetaInvite` table is retained only for migration compatibility and legacy data cleanup, never authorization. Old sessions stop working. A later Google sign-in deliberately creates a fresh account without recovering deleted reports.

## Verify after deployment

1. Open the deployment signed out: the Vibe sign-in screen should appear without beta or invitation copy.
2. Sign in with a verified Google account that has no historical enrollment record: access must succeed without an administrator action.
3. Run one ZIP or public GitHub scan.
4. Confirm the scan appears only in that account's saved scan list.
5. Sign out, then confirm `/api/scans` returns `401` and GitHub cannot be connected.

Use disposable accounts for destructive tests. Never delete the owner's account just to prove the flow. Do not put Google credentials, database URLs, or personal emails in Git.
