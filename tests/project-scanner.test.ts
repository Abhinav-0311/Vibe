import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { scanProject } from "@/lib/scanner/project-scanner";

const temporaryProjects: string[] = [];

async function createProject() {
  const projectRoot = await fs.mkdtemp(path.join(os.tmpdir(), "vibe-scanner-test-"));
  temporaryProjects.push(projectRoot);
  await fs.writeFile(
    path.join(projectRoot, "package.json"),
    JSON.stringify({ dependencies: { next: "15.0.0", stripe: "17.0.0" } }),
  );
  return projectRoot;
}

async function createFile(
  projectRoot: string,
  relativePath: string,
  content = "export async function GET() {}\n",
) {
  const targetPath = path.join(projectRoot, relativePath);
  await fs.mkdir(path.dirname(targetPath), { recursive: true });
  await fs.writeFile(targetPath, content);
}

afterEach(async () => {
  await Promise.all(temporaryProjects.splice(0).map((project) => fs.rm(project, { recursive: true, force: true })));
});

describe("scanProject API route discovery", () => {
  it("detects and classifies App Router and Pages Router API routes", async () => {
    const projectRoot = await createProject();
    await createFile(projectRoot, "app/api/auth/login/route.ts");
    await createFile(projectRoot, "app/api/stripe/webhook/route.ts");
    await createFile(projectRoot, "pages/api/health.ts");

    const facts = await scanProject(projectRoot);

    expect(facts.apiRoutes.map((route) => route.route)).toEqual([
      "/api/auth/login",
      "/api/health",
      "/api/stripe/webhook",
    ]);
    expect(facts.signals.hasAuthRoute).toBe(true);
    expect(facts.signals.hasCredentialAuthRoute).toBe(true);
    expect(facts.signals.hasPasswordRecoveryRoute).toBe(false);
    expect(facts.signals.hasSessionManagementRoute).toBe(false);
    expect(facts.signals.hasPaymentRoute).toBe(true);
    expect(facts.signals.hasWebhookRoute).toBe(true);
    expect(facts.signals.hasWebhookSignatureVerification).toBe(false);
    expect(facts.signals.hasHealthRoute).toBe(true);
    expect(facts.signals.hasWildcardCors).toBe(false);
  });

  it("detects Stripe signature verification inside a webhook route", async () => {
    const projectRoot = await createProject();
    await createFile(
      projectRoot,
      "app/api/stripe/webhook/route.ts",
      "export async function POST(request) { return stripe.webhooks.constructEvent(await request.text(), request.headers.get('stripe-signature'), process.env.STRIPE_WEBHOOK_SECRET); }\n",
    );

    const facts = await scanProject(projectRoot);

    expect(facts.signals.hasWebhookRoute).toBe(true);
    expect(facts.signals.hasWebhookSignatureVerification).toBe(true);
  });

  it("classifies account recovery and session-management routes", async () => {
    const projectRoot = await createProject();
    await createFile(projectRoot, "app/api/auth/forgot-password/route.ts");
    await createFile(projectRoot, "app/api/auth/logout/route.ts");

    const facts = await scanProject(projectRoot);

    expect(facts.signals.hasPasswordRecoveryRoute).toBe(true);
    expect(facts.signals.hasSessionManagementRoute).toBe(true);
  });

  it("checks every detected environment filename against gitignore patterns", async () => {
    const projectRoot = await createProject();
    await createFile(projectRoot, ".env.production", "SECRET=not-read-by-the-scanner\n");
    await createFile(projectRoot, ".gitignore", ".env\n");

    const partiallyIgnoredFacts = await scanProject(projectRoot);
    expect(partiallyIgnoredFacts.signals.hasLocalEnvFile).toBe(true);
    expect(partiallyIgnoredFacts.signals.hasEnvGitignoreRule).toBe(false);

    await createFile(projectRoot, ".gitignore", ".env*\n");
    const safelyIgnoredFacts = await scanProject(projectRoot);
    expect(safelyIgnoredFacts.signals.hasEnvGitignoreRule).toBe(true);
  });

  it("detects rate-limiting evidence in bounded API route source", async () => {
    const projectRoot = await createProject();
    await createFile(
      projectRoot,
      "app/api/auth/login/route.ts",
      "export async function POST() { return Response.json({}, { status: 429 }); }\n",
    );

    const facts = await scanProject(projectRoot);

    expect(facts.signals.hasRateLimitImplementation).toBe(true);
  });

  it("records the API route containing a wildcard CORS policy", async () => {
    const projectRoot = await createProject();
    await createFile(
      projectRoot,
      "app/api/public/route.ts",
      'export function GET() { return new Response("ok", { headers: { "Access-Control-Allow-Origin": "*" } }); }\n',
    );

    const facts = await scanProject(projectRoot);

    expect(facts.signals.hasWildcardCors).toBe(true);
    expect(facts.securityEvidence?.wildcardCorsFiles).toEqual(["app/api/public/route.ts"]);
  });

  it("records auth files with explicitly insecure cookie options", async () => {
    const projectRoot = await createProject();
    await createFile(
      projectRoot,
      "app/api/auth/login/route.ts",
      "export async function POST() { cookies().set('session', 'token', { httpOnly: false, secure: false }); }\n",
    );

    const facts = await scanProject(projectRoot);

    expect(facts.signals.hasInsecureSessionCookie).toBe(true);
    expect(facts.securityEvidence?.insecureSessionCookieFiles).toEqual([
      "app/api/auth/login/route.ts",
    ]);
  });
});
