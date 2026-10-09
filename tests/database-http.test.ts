import { spawn, type ChildProcess } from "node:child_process";
import { randomUUID } from "node:crypto";
import { createServer } from "node:net";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import AdmZip from "adm-zip";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { nextJsGuidanceCatalogVersion } from "@/lib/nextjs-guidance";

const databaseUrl = process.env.VIBE_TEST_DATABASE_URL;
if (databaseUrl) {
  const url = new URL(databaseUrl);
  if (!["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) || url.pathname !== "/vibe_closeout_test") {
    throw new Error("HTTP integration tests require the isolated loopback database vibe_closeout_test.");
  }
}

type TestUser = { id: string; email: string; sessionToken: string };

describe.skipIf(!databaseUrl).sequential("production HTTP handlers with real PostgreSQL and database sessions", () => {
  let db: PrismaClient;
  let server: ChildProcess | undefined;
  let origin: string;
  const users: TestUser[] = [];
  const archive = new AdmZip();
  archive.addFile("fixture/package.json", Buffer.from(JSON.stringify({ name: "http-acceptance", scripts: { build: "node --check index.js" } })));
  archive.addFile("fixture/index.js", Buffer.from("export const title = 'Public content';"));
  const archiveBytes = archive.toBuffer();

  async function createUser() {
    const id = `closeout-${randomUUID()}`;
    const user = { id, email: `${id}@example.invalid`, sessionToken: randomUUID() };
    users.push(user);
    await db.user.create({ data: {
      id, email: user.email,
      accounts: { create: { type: "oauth", provider: "google", providerAccountId: id, access_token: "synthetic-test-token" } },
      sessions: { create: { sessionToken: user.sessionToken, expires: new Date(Date.now() + 3_600_000) } },
    } });
    return user;
  }

  function request(route: string, user?: TestUser, init: RequestInit = {}) {
    const headers = new Headers(init.headers);
    if (user) headers.set("cookie", `next-auth.session-token=${user.sessionToken}`);
    return fetch(`${origin}${route}`, { ...init, headers, signal: AbortSignal.timeout(15_000) });
  }

  function upload(user: TestUser) {
    const body = new FormData();
    body.set("project", new File([new Uint8Array(archiveBytes)], "http-acceptance.zip", { type: "application/zip" }));
    body.set("stage", "launch-prep");
    body.set("appType", "content-site");
    body.set("profileMode", "manual");
    return request("/api/upload-scan", user, { method: "POST", body });
  }

  beforeAll(async () => {
    db = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl! }) });
    await db.$connect();
    const port = await new Promise<number>((resolve, reject) => {
      const listener = createServer();
      listener.on("error", reject);
      listener.listen(0, "127.0.0.1", () => {
        const address = listener.address();
        if (!address || typeof address === "string") return reject(new Error("No local test port."));
        listener.close(() => resolve(address.port));
      });
    });
    origin = `http://127.0.0.1:${port}`;
    server = spawn(process.execPath, [path.resolve("node_modules/next/dist/bin/next"), "start", "--hostname", "127.0.0.1", "--port", String(port)], {
      env: {
        ...process.env, NODE_ENV: "production", DATABASE_URL: databaseUrl!, NEXTAUTH_URL: origin,
        NEXTAUTH_URL_INTERNAL: origin, NEXT_PUBLIC_APP_URL: origin, NEXTAUTH_SECRET: randomUUID(),
        VIBE_RATE_LIMIT_SECRET: randomUUID(), VIBE_DAILY_SCAN_LIMIT: "20", VIBE_ENABLE_LOCAL_SCAN: "false",
        GOOGLE_CLIENT_ID: "", GOOGLE_CLIENT_SECRET: "", GITHUB_CLIENT_ID: "", GITHUB_CLIENT_SECRET: "",
        OPENAI_REPORT_ENABLED: "false", OPENAI_API_KEY: "", SENTRY_DSN: "",
      },
      stdio: "ignore",
    });
    for (let attempt = 0; attempt < 50; attempt++) {
      if (server.exitCode !== null) throw new Error("Build the app before running HTTP integration tests.");
      try {
        if ((await request("/api/health")).ok) break;
      } catch { /* The local server is still starting. */ }
      await delay(100);
    }
    expect((await request("/api/health")).status).toBe(200);
    await createUser();
    await createUser();
  }, 30_000);

  afterAll(async () => {
    server?.kill();
    if (db) {
      try {
        await db.user.deleteMany({ where: { id: { in: users.map((user) => user.id) } } });
        await db.betaInvite.deleteMany({ where: { email: { in: users.map((user) => user.email) } } });
      } finally {
        await db.$disconnect();
      }
    }
  });

  it("allows accounts without invitations and isolates scans, restore, feedback, and quotas", async () => {
    expect((await request("/api/scans")).status).toBe(401);
    expect(await db.betaInvite.count({ where: { email: { in: users.map((user) => user.email) } } })).toBe(0);
    // A historical disabled enrollment must not deny a valid session either.
    await db.betaInvite.create({ data: { email: users[1].email, active: false } });
    for (const [index, user] of users.entries()) {
      const response = await upload(user);
      expect(response.status).toBe(200);
      expect((await response.json()).persistence.saved).toBe(true);
      for (const [route, data] of [
        ["/api/finding-feedback", { projectKey: "shared-test-project", findingId: "missing-tests", helpful: index === 0 }],
        ["/api/guidance-feedback", { guidanceId: "nextjs-route-handlers", catalogVersion: nextJsGuidanceCatalogVersion, helpful: index === 0 }],
      ] as const) {
        expect((await request(route, user, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(data) })).status).toBe(200);
      }
    }
    const saved = await Promise.all(users.map(async (user) => (await (await request("/api/scans", user)).json()).records as Array<{ id: string }>));
    expect(saved.map((records) => records.length)).toEqual([1, 1]);
    expect(saved[0][0].id).not.toBe(saved[1][0].id);
    for (const [index, user] of users.entries()) {
      expect((await request(`/api/scans/${saved[index][0].id}`, user)).status).toBe(200);
      expect((await request(`/api/scans/${saved[1 - index][0].id}`, user)).status).toBe(404);
      for (const route of ["/api/finding-feedback?projectKey=shared-test-project", "/api/guidance-feedback"]) {
        const { feedback } = await (await request(route, user)).json();
        expect(feedback).toHaveLength(1);
        expect(feedback[0].helpful).toBe(index === 0);
      }
      expect((await (await request("/api/account", user)).json()).scansUsedToday).toBe(1);
    }
  }, 30_000);

  it("deletes only the disposable account, cascades its data, and revokes its database session", async () => {
    const [deleted, retained] = users;
    await db.betaInvite.create({ data: { email: deleted.email, active: false } });
    const response = await request("/api/account", deleted, { method: "DELETE" });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ deleted: true });
    expect(await db.user.findUnique({ where: { id: deleted.id } })).toBeNull();
    expect(await db.betaInvite.findUnique({ where: { email: deleted.email } })).toBeNull();
    for (const user of [deleted, retained]) {
      const where = { userId: user.id };
      expect(await Promise.all([
        db.account.count({ where }), db.session.count({ where }), db.scanRecord.count({ where }),
        db.scanQuotaUsage.count({ where }), db.findingFeedback.count({ where }), db.guidanceFeedback.count({ where }),
      ])).toEqual(Array(6).fill(user === deleted ? 0 : 1));
    }
    expect((await request("/api/scans", deleted)).status).toBe(401);
    expect((await request("/api/account", retained)).status).toBe(200);
  }, 20_000);

  it("bounds 20 concurrent real HTTP uploads with durable rate limits and atomic quota accounting", async () => {
    const user = await createUser();
    await db.scanRateLimit.deleteMany(); // The guard above restricts all writes to the disposable local database.
    const started = performance.now();
    const responses = await Promise.all(Array.from({ length: 20 }, async () => {
      const response = await upload(user);
      return { status: response.status, retryAfter: response.headers.get("retry-after"), body: await response.json() };
    }));
    const accepted = responses.filter((response) => response.status === 200);
    const limited = responses.filter((response) => response.status === 429);
    expect(accepted).toHaveLength(4);
    expect(limited).toHaveLength(16);
    expect(accepted.every((response) => response.body.persistence.saved)).toBe(true);
    expect(new Set(accepted.map((response) => response.body.checklist.score)).size).toBe(1);
    expect(limited.every((response) => Number(response.retryAfter) > 0)).toBe(true);
    expect((await (await request("/api/account", user)).json()).scansUsedToday).toBe(20);
    const exhausted = await upload(user);
    expect(exhausted.status).toBe(429);
    expect((await exhausted.json()).code).toBe("quota_exceeded");
    console.info(JSON.stringify({ localHttpLoad: { requests: 20, accepted: accepted.length, limited: limited.length, elapsedMs: Math.round(performance.now() - started) } }));
  }, 30_000);
});
