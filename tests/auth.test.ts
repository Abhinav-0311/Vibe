import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Profile } from "next-auth";

const mocks = vi.hoisted(() => ({
  getPrisma: vi.fn(), getServerSession: vi.fn(), inviteLookup: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({ getPrisma: mocks.getPrisma }));
vi.mock("next-auth", () => ({ getServerSession: mocks.getServerSession }));
vi.mock("@next-auth/prisma-adapter", () => ({ PrismaAdapter: vi.fn(() => ({})) }));

import { authOptions, getAuthenticatedUser, getDailyScanLimit } from "@/lib/auth";

beforeEach(() => {
  vi.resetAllMocks();
  mocks.getPrisma.mockReturnValue({ betaInvite: { findUnique: mocks.inviteLookup } });
  vi.stubEnv("VIBE_DAILY_SCAN_LIMIT", undefined);
  vi.stubEnv("VIBE_BETA_DAILY_SCAN_LIMIT", undefined);
});
afterEach(() => vi.unstubAllEnvs());

function authenticate(profile: (Profile & { email_verified?: boolean }) | undefined, provider = "google", email = "reader@example.com") {
  return authOptions.callbacks!.signIn!({
    user: { id: "new-user", email },
    account: { provider, type: "oauth", providerAccountId: "google-user-id" },
    profile,
  });
}

describe("open Google registration", () => {
  it("accepts a verified Google identity without looking up an invitation", async () => {
    expect(await authenticate({ email: "READER@example.com", email_verified: true })).toBe(true);
    expect(mocks.inviteLookup).not.toHaveBeenCalled();
  });

  it.each([
    { email: "reader@example.com", email_verified: false },
    { email: "reader@example.com" },
    { email: "someone-else@example.com", email_verified: true },
    { email_verified: true },
    undefined,
  ])("rejects an unverified, missing, or mismatched Google profile: %j", async (profile) => {
    expect(await authenticate(profile)).toBe(false);
  });

  it("does not accept another provider or an identity without an email", async () => {
    const profile = { email: "reader@example.com", email_verified: true };
    expect(await authenticate(profile, "github")).toBe(false);
    expect(await authenticate(profile, "google", "")).toBe(false);
  });

  it("does not register an account without the persistent identity store", async () => {
    mocks.getPrisma.mockReturnValue(null);
    expect(await authenticate({ email: "reader@example.com", email_verified: true })).toBe(false);
  });
});

describe("authenticated ownership boundary", () => {
  it("accepts a valid database session without an enrollment lookup", async () => {
    mocks.getServerSession.mockResolvedValue({ user: { id: "user-a", email: "Reader@example.com" } });
    expect(await getAuthenticatedUser()).toEqual({ id: "user-a", email: "reader@example.com" });
    expect(mocks.inviteLookup).not.toHaveBeenCalled();
  });

  it.each([null, { user: { email: "reader@example.com" } }, { user: { id: "user-a" } }])(
    "rejects a missing or incomplete session: %j", async (session) => {
      mocks.getServerSession.mockResolvedValue(session);
      expect(await getAuthenticatedUser()).toBeNull();
    },
  );

  it("fails closed if the database is unavailable", async () => {
    mocks.getServerSession.mockResolvedValue({ user: { id: "user-a", email: "reader@example.com" } });
    mocks.getPrisma.mockReturnValue(null);
    expect(await getAuthenticatedUser()).toBeNull();
  });
});

describe("daily scan configuration", () => {
  it("defaults to 20 scan attempts per UTC day", () => {
    expect(getDailyScanLimit()).toBe(20);
  });

  it("preserves an existing deployment's legacy limit", () => {
    vi.stubEnv("VIBE_BETA_DAILY_SCAN_LIMIT", "7");
    expect(getDailyScanLimit()).toBe(7);
  });

  it("prefers the current setting over the legacy limit", () => {
    vi.stubEnv("VIBE_BETA_DAILY_SCAN_LIMIT", "7");
    vi.stubEnv("VIBE_DAILY_SCAN_LIMIT", "5");
    expect(getDailyScanLimit()).toBe(5);
  });

  it.each(["0", "-1", "invalid"])("does not disable limits for invalid configuration: %s", (value) => {
    vi.stubEnv("VIBE_DAILY_SCAN_LIMIT", value);
    expect(getDailyScanLimit()).toBe(20);
  });
});
