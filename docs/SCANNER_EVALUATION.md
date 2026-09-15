# Scanner evaluation corpus

Vibe uses deterministic local fixtures for its scanner evaluation suite. The suite creates small projects on disk and exercises the same static scanner, profile inference, and checklist pipeline used by scans. It never downloads repositories or executes fixture code.

## Current coverage

The representative suite covers twelve project shapes:

- Static Next.js content site
- Vite portfolio
- Login UI without verified authentication
- Express API without framework-specific route files
- Next.js credential SaaS
- Stripe SaaS with and without a verified webhook
- Supabase-backed subscription SaaS
- Launch-stage API with health, middleware, and rate-limit evidence
- Create React App with client-auth evidence
- Environment-file safety
- Next.js loading and error boundaries

## Human-reviewed public benchmarks

These public repositories have also been reviewed manually through Vibe. They are evidence for calibration decisions, not network-dependent test inputs:

| Repository | Shape exercised |
| --- | --- |
| `Aayush10016/HipHopHub` | Vite React UI and accessibility evidence |
| `gothinkster/node-express-realworld-example-app` | Express API profile inference |
| `vercel/nextjs-subscription-payments` | Next.js SaaS, Supabase data, Stripe, and account signals |
| `t3-oss/create-t3-turbo` | Monorepo app-path selection and root lockfile inheritance |

## Adding a regression case

When a real scan exposes a false positive or false negative:

1. Record the observed evidence and desired outcome.
2. Add the smallest fixture that reproduces those signals to `tests/representative-projects.test.ts` or an existing focused scanner test.
3. Assert the framework, inferred profile, and only the relevant finding IDs.
4. Run `npm test`, `npm run lint`, and `npm run build`.

Avoid live-repository tests in CI. Remote branches, archives, and rate limits make them non-deterministic.
