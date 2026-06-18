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

async function createFile(projectRoot: string, relativePath: string) {
  const targetPath = path.join(projectRoot, relativePath);
  await fs.mkdir(path.dirname(targetPath), { recursive: true });
  await fs.writeFile(targetPath, "export async function GET() {}\n");
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
    expect(facts.signals.hasPaymentRoute).toBe(true);
    expect(facts.signals.hasWebhookRoute).toBe(true);
    expect(facts.signals.hasHealthRoute).toBe(true);
  });
});
