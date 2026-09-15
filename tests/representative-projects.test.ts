import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { inferAuditProfile } from "@/lib/checklist/context-inference";
import { runChecklist } from "@/lib/checklist/checklist-engine";
import type { AuditContext } from "@/lib/checklist/types";
import { scanProject } from "@/lib/scanner/project-scanner";

const temporaryProjects: string[] = [];

const startingProfile: AuditContext = {
  appType: "content-site",
  stage: "prototype",
  hasPayments: false,
  hasUserAccounts: false,
  storesUserData: false,
};

type RepresentativeProject = {
  name: string;
  files: Record<string, string>;
  framework: string;
  requestedProfile?: AuditContext;
  profile: Partial<AuditContext>;
  signals?: Array<keyof Awaited<ReturnType<typeof scanProject>>["signals"]>;
  requiredFindings?: string[];
  absentFindings?: string[];
};

const representativeProjects: readonly RepresentativeProject[] = [
  {
    name: "static Next.js content site",
    files: {
      "package.json": JSON.stringify({ scripts: { build: "next build" }, dependencies: { next: "15.0.0", react: "19.0.0" } }),
      "app/page.tsx": "export default function Page() { return <main>Public content</main>; }\n",
      "pnpm-lock.yaml": "lockfileVersion: '9.0'\n",
    },
    framework: "Next.js",
    profile: { appType: "content-site", stage: "prototype", hasUserAccounts: false, hasPayments: false, storesUserData: false },
    absentFindings: ["missing-auth", "missing-stripe"],
  },
  {
    name: "Vite portfolio",
    files: {
      "package.json": JSON.stringify({ scripts: { build: "vite build" }, dependencies: { vite: "6.0.0", react: "19.0.0" } }),
      "src/App.tsx": "export default function App() { return <main>Portfolio</main>; }\n",
      "package-lock.json": "{}\n",
    },
    framework: "Vite React",
    profile: { appType: "content-site", stage: "prototype", hasUserAccounts: false, hasPayments: false, storesUserData: false },
    absentFindings: ["missing-auth", "missing-rate-limiting"],
  },
  {
    name: "Vite login screen without verified authentication",
    files: {
      "package.json": JSON.stringify({ dependencies: { vite: "6.0.0", react: "19.0.0" } }),
      "src/pages/Login.tsx": "export default function Login() { return <button>Log in</button>; }\n",
    },
    framework: "Vite React",
    profile: { hasUserAccounts: false, appType: "content-site" },
    absentFindings: ["missing-auth"],
  },
  {
    name: "Express API without framework-specific route files",
    files: {
      "package.json": JSON.stringify({ scripts: { start: "node src/server.js" }, dependencies: { express: "5.0.0" } }),
      "src/server.js": "import express from 'express'; const app = express(); app.listen(3000);\n",
    },
    framework: "Express",
    profile: { appType: "api", stage: "prototype", hasUserAccounts: false, hasPayments: false },
  },
  {
    name: "Next.js credential SaaS",
    files: {
      "package.json": JSON.stringify({ dependencies: { next: "15.0.0", react: "19.0.0", "next-auth": "5.0.0" } }),
      "app/api/auth/login/route.ts": "export async function POST() { return Response.json({}); }\n",
    },
    framework: "Next.js",
    profile: { appType: "saas", stage: "launch-prep", hasUserAccounts: true, hasPayments: false },
    signals: ["hasCredentialAuthRoute"],
  },
  {
    name: "Next.js paid SaaS without a webhook",
    files: {
      "package.json": JSON.stringify({ dependencies: { next: "15.0.0", react: "19.0.0", stripe: "17.0.0" } }),
      "app/page.tsx": "export default function Page() { return <main>Subscribe</main>; }\n",
    },
    framework: "Next.js",
    profile: { appType: "saas", stage: "launch-prep", hasPayments: true, hasUserAccounts: false },
    requiredFindings: ["missing-payment-webhook"],
  },
  {
    name: "Next.js paid SaaS with verified Stripe webhook",
    files: {
      "package.json": JSON.stringify({ dependencies: { next: "15.0.0", react: "19.0.0", stripe: "17.0.0" } }),
      "app/api/stripe/webhook/route.ts": "export async function POST(request: Request) { return stripe.webhooks.constructEvent(await request.text(), request.headers.get('stripe-signature'), process.env.STRIPE_WEBHOOK_SECRET); }\n",
    },
    framework: "Next.js",
    profile: { appType: "saas", stage: "launch-prep", hasPayments: true },
    signals: ["hasWebhookSignatureVerification"],
    absentFindings: ["missing-payment-webhook", "unverified-payment-webhook"],
  },
  {
    name: "Next.js Supabase subscription product",
    files: {
      "package.json": JSON.stringify({ dependencies: { next: "15.0.0", react: "19.0.0", stripe: "17.0.0", "@supabase/ssr": "0.1.0", "@supabase/supabase-js": "2.0.0" } }),
      "app/api/auth/login/route.ts": "export async function POST() { return Response.json({}); }\n",
      "supabase/migrations/initial.sql": "create table profiles (id uuid primary key);\n",
    },
    framework: "Next.js",
    profile: { appType: "saas", stage: "launch-prep", hasUserAccounts: true, hasPayments: true, storesUserData: true },
  },
  {
    name: "Next.js launch API with health and rate-limit evidence",
    files: {
      "package.json": JSON.stringify({ dependencies: { next: "15.0.0", react: "19.0.0" } }),
      "app/api/health/route.ts": "export async function GET() { return Response.json({ status: 'ok' }); }\n",
      "app/api/search/route.ts": "export async function GET() { return Response.json({}, { status: 429 }); }\n",
      "middleware.ts": "export function middleware() {}\n",
    },
    framework: "Next.js",
    requestedProfile: { ...startingProfile, appType: "api", stage: "launch-prep", storesUserData: true },
    profile: { appType: "api", stage: "launch-prep", storesUserData: true },
    signals: ["hasHealthRoute", "hasRateLimitImplementation", "hasMiddleware"],
    requiredFindings: ["missing-rate-limiting"],
    absentFindings: ["missing-health-route", "missing-middleware"],
  },
  {
    name: "Create React App with durable client-auth evidence",
    files: {
      "package.json": JSON.stringify({ scripts: { build: "react-scripts build" }, dependencies: { react: "19.0.0", "react-scripts": "5.0.0" } }),
      "src/context/AuthContext.js": "export const AuthContext = createContext(null);\n",
      "src/components/ProtectedRoute.js": "export function ProtectedRoute() { return null; }\n",
      "src/__tests__/auth.test.js": "it('protects a route', () => {});\n",
    },
    framework: "Create React App",
    profile: { appType: "content-site", stage: "prototype" },
    signals: ["hasTests"],
  },
  {
    name: "Next.js repository with ignored environment files",
    files: {
      "package.json": JSON.stringify({ dependencies: { next: "15.0.0", react: "19.0.0" } }),
      ".env.local": "PRIVATE_VALUE=never-read\n",
      ".gitignore": ".env*\n",
    },
    framework: "Next.js",
    profile: { appType: "content-site", stage: "prototype" },
    signals: ["hasLocalEnvFile", "hasEnvGitignoreRule"],
  },
  {
    name: "Next.js app with explicit loading and recovery boundaries",
    files: {
      "package.json": JSON.stringify({ dependencies: { next: "15.0.0", react: "19.0.0" } }),
      "app/loading.tsx": "export default function Loading() { return <p>Loading</p>; }\n",
      "app/error.tsx": "'use client'; export default function Error() { return <button>Try again</button>; }\n",
    },
    framework: "Next.js",
    profile: { appType: "content-site", stage: "prototype" },
  },
];

async function writeFixture(projectRoot: string, files: Record<string, string>) {
  await Promise.all(
    Object.entries(files).map(async ([relativePath, content]) => {
      const target = path.join(projectRoot, relativePath);
      await fs.mkdir(path.dirname(target), { recursive: true });
      await fs.writeFile(target, content);
    }),
  );
}

afterEach(async () => {
  await Promise.all(temporaryProjects.splice(0).map((projectRoot) => fs.rm(projectRoot, { recursive: true, force: true })));
});

describe("representative scanner evaluation corpus", () => {
  it.each(representativeProjects)("classifies $name", async (fixture) => {
    const projectRoot = await fs.mkdtemp(path.join(os.tmpdir(), "vibe-representative-project-"));
    temporaryProjects.push(projectRoot);
    await writeFixture(projectRoot, fixture.files);

    const facts = await scanProject(projectRoot);
    const profile = inferAuditProfile(facts, fixture.requestedProfile ?? startingProfile);
    const findings = runChecklist(facts, profile.applied).findings.map((finding) => finding.id);

    expect(facts.framework.name).toBe(fixture.framework);
    expect(profile.applied).toMatchObject(fixture.profile);
    for (const signal of fixture.signals ?? []) expect(facts.signals[signal]).toBe(true);
    for (const finding of fixture.requiredFindings ?? []) expect(findings).toContain(finding);
    for (const finding of fixture.absentFindings ?? []) expect(findings).not.toContain(finding);
  });
});
