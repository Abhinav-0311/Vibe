import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { inferAuditProfile, selectedAuditProfile } from "@/lib/checklist/context-inference";
import { runChecklist } from "@/lib/checklist/checklist-engine";
import type { AuditContext } from "@/lib/checklist/types";
import { scanProject } from "@/lib/scanner/project-scanner";

const temporaryProjects: string[] = [];

const contentProfile: AuditContext = {
  appType: "content-site",
  stage: "prototype",
  hasPayments: false,
  hasUserAccounts: false,
  storesUserData: false,
};

async function createProject(packageJson: Record<string, unknown>) {
  const projectRoot = await fs.mkdtemp(path.join(os.tmpdir(), "vibe-calibration-"));
  temporaryProjects.push(projectRoot);
  await writeFile(projectRoot, "package.json", JSON.stringify(packageJson));
  await writeFile(projectRoot, "next.config.ts", "export default {};\n");
  return projectRoot;
}

async function writeFile(projectRoot: string, relativePath: string, content: string) {
  const targetPath = path.join(projectRoot, relativePath);
  await fs.mkdir(path.dirname(targetPath), { recursive: true });
  await fs.writeFile(targetPath, content);
}

afterEach(async () => {
  await Promise.all(temporaryProjects.splice(0).map((projectRoot) => fs.rm(projectRoot, { recursive: true, force: true })));
});

describe("scanner calibration matrix", () => {
  it("keeps a static Next.js content site out of SaaS-only checks", async () => {
    const projectRoot = await createProject({ dependencies: { next: "15.0.0", react: "19.0.0" } });
    await writeFile(projectRoot, "app/page.tsx", "export default function Page() { return <main>Portfolio</main>; }\n");

    const facts = await scanProject(projectRoot);
    const profile = inferAuditProfile(facts, contentProfile);
    const findingIds = runChecklist(facts, profile.applied).findings.map((finding) => finding.id);

    expect(profile.applied).toEqual(contentProfile);
    expect(findingIds).not.toContain("missing-auth");
    expect(findingIds).not.toContain("missing-stripe");
  });

  it("does not mistake a GitHub integration OAuth route for end-user login", async () => {
    const projectRoot = await createProject({ dependencies: { next: "15.0.0", react: "19.0.0" } });
    await writeFile(projectRoot, "app/api/github/oauth/callback/route.ts", "export async function GET() { return Response.json({}); }\n");

    const facts = await scanProject(projectRoot);
    const profile = inferAuditProfile(facts, contentProfile);

    expect(facts.signals.hasAuthRoute).toBe(false);
    expect(profile.applied).toEqual(contentProfile);
  });

  it("flags auth-like UI as profile context without treating it as verified authentication", async () => {
    const projectRoot = await createProject({ dependencies: { vite: "6.0.0", react: "19.0.0" } });
    await writeFile(projectRoot, "src/pages/LoginPage.tsx", "export default function LoginPage() { return <button>Log in</button>; }\n");

    const facts = await scanProject(projectRoot);
    const profile = selectedAuditProfile({ ...contentProfile, stage: "launch-prep", appType: "saas" }, facts);

    expect(facts.uiEvidence?.authLikeUiFiles).toContain("src/pages/LoginPage.tsx");
    expect(profile.applied.hasUserAccounts).toBe(false);
    expect(profile.reasons.join(" ")).toContain("UI alone does not prove authentication works");
  });

  it("requires source-level environment usage before reporting a missing env example", async () => {
    const projectRoot = await createProject({ dependencies: { vite: "6.0.0", react: "19.0.0" } });
    await writeFile(projectRoot, "src/App.tsx", "export default function App() { return <main>Static page</main>; }\n");

    const facts = await scanProject(projectRoot);
    const findingIds = runChecklist(facts, { ...contentProfile, stage: "launch-prep", appType: "saas" }).findings.map((finding) => finding.id);

    expect(facts.signals.hasEnvironmentVariableUsage).toBe(false);
    expect(findingIds).not.toContain("missing-env-example");
  });

  it("keeps missing error tracking below high severity for a frontend-only SaaS profile", async () => {
    const projectRoot = await createProject({ dependencies: { vite: "6.0.0", react: "19.0.0" } });
    await writeFile(projectRoot, "src/App.tsx", "export default function App() { return <main>App</main>; }\n");

    const facts = await scanProject(projectRoot);
    const finding = runChecklist(facts, { ...contentProfile, stage: "launch-prep", appType: "saas" }).findings.find(
      (item) => item.id === "missing-error-tracking",
    );

    expect(finding?.severity).toBe("medium");
  });

  it("promotes a credential-auth SaaS app and retains the auth evidence", async () => {
    const projectRoot = await createProject({
      dependencies: { next: "15.0.0", react: "19.0.0", "next-auth": "5.0.0" },
    });
    await writeFile(projectRoot, "app/api/auth/login/route.ts", "export async function POST() { return Response.json({}); }\n");

    const facts = await scanProject(projectRoot);
    const profile = inferAuditProfile(facts, contentProfile);

    expect(facts.signals.hasAuthRoute).toBe(true);
    expect(facts.signals.hasCredentialAuthRoute).toBe(true);
    expect(profile.applied).toMatchObject({ appType: "saas", stage: "launch-prep", hasUserAccounts: true });
  });

  it("recognizes a verified Stripe webhook without raising payment-webhook findings", async () => {
    const projectRoot = await createProject({ dependencies: { next: "15.0.0", react: "19.0.0", stripe: "17.0.0" } });
    await writeFile(
      projectRoot,
      "app/api/stripe/webhook/route.ts",
      "export async function POST(request: Request) { return stripe.webhooks.constructEvent(await request.text(), request.headers.get('stripe-signature'), process.env.STRIPE_WEBHOOK_SECRET); }\n",
    );

    const facts = await scanProject(projectRoot);
    const result = runChecklist(facts, { ...contentProfile, appType: "saas", stage: "launch-prep", hasPayments: true });
    const findingIds = result.findings.map((finding) => finding.id);

    expect(facts.signals.hasWebhookSignatureVerification).toBe(true);
    expect(findingIds).not.toContain("missing-payment-webhook");
    expect(findingIds).not.toContain("unverified-payment-webhook");
  });

  it("preserves concrete evidence for unsafe CORS and session cookies", async () => {
    const projectRoot = await createProject({ dependencies: { next: "15.0.0", react: "19.0.0" } });
    await writeFile(
      projectRoot,
      "app/api/auth/login/route.ts",
      "export async function POST() { cookies().set('session', 'token', { httpOnly: false, secure: false }); return new Response('ok', { headers: { 'Access-Control-Allow-Origin': '*' } }); }\n",
    );

    const facts = await scanProject(projectRoot);
    const result = runChecklist(facts, { ...contentProfile, appType: "saas", stage: "launch-prep", hasUserAccounts: true });
    const findingIds = result.findings.map((finding) => finding.id);

    expect(facts.securityEvidence?.wildcardCorsFiles).toEqual(["app/api/auth/login/route.ts"]);
    expect(facts.securityEvidence?.insecureSessionCookieFiles).toEqual(["app/api/auth/login/route.ts"]);
    expect(findingIds).toEqual(expect.arrayContaining(["wildcard-cors", "insecure-session-cookie"]));
  });
});
