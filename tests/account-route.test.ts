import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({ getBetaUser: vi.fn() }));
vi.mock("@/lib/beta-account", () => ({ deleteBetaAccount: vi.fn(), getBetaAccountSummary: vi.fn() }));
vi.mock("@/lib/observability/server", () => ({ reportServerError: vi.fn() }));

import { DELETE } from "@/app/api/account/route";
import { getBetaUser } from "@/lib/auth";
import { deleteBetaAccount } from "@/lib/beta-account";
import { githubTokenCookie, githubOauthStateCookie, githubOauthVerifierCookie } from "@/lib/github/github-oauth";

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(getBetaUser).mockResolvedValue({ id: "user-a", email: "tester@example.com" });
  vi.mocked(deleteBetaAccount).mockResolvedValue(true);
});

describe("account deletion route", () => {
  it("expires GitHub token and pending OAuth cookies only after confirmed deletion", async () => {
    const response = await DELETE();
    expect(await response.json()).toEqual({ deleted: true });
    expect(deleteBetaAccount).toHaveBeenCalledWith({ id: "user-a", email: "tester@example.com" });
    for (const name of [githubTokenCookie, githubOauthStateCookie, githubOauthVerifierCookie]) {
      expect(response.cookies.get(name)).toMatchObject({ name, value: "", path: "/", expires: new Date(0) });
    }
  });

  it("does not delete anything for an unauthenticated request", async () => {
    vi.mocked(getBetaUser).mockResolvedValue(null);
    const response = await DELETE();
    expect(response.status).toBe(401);
    expect(deleteBetaAccount).not.toHaveBeenCalled();
    expect(response.cookies.getAll()).toEqual([]);
  });

  it("preserves connection cookies when no account was deleted", async () => {
    vi.mocked(deleteBetaAccount).mockResolvedValue(false);
    const response = await DELETE();
    expect(response.status).toBe(409);
    expect(response.cookies.getAll()).toEqual([]);
  });

  it("does not expose database errors or clear cookies after a failed transaction", async () => {
    vi.mocked(deleteBetaAccount).mockRejectedValue(new Error("private database detail"));
    const response = await DELETE();
    expect(response.status).toBe(503);
    expect(JSON.stringify(await response.json())).not.toContain("private database detail");
    expect(response.cookies.getAll()).toEqual([]);
  });
});
