import { describe, expect, it, vi } from "vitest";
import { completeAccountDeletion } from "@/lib/account-deletion";
import { clearBrowserAccountData, storageKeyForUser } from "@/lib/scan-history";

function actions() {
  return {
    requestDeletion: vi.fn(async () => ({ ok: true })),
    onDeleted: vi.fn(),
    clearBrowserData: vi.fn(),
    signOut: vi.fn(async () => undefined),
  };
}

describe("account deletion cleanup", () => {
  it("stops persistence and clears browser data before signing out", async () => {
    const calls = actions();
    expect(await completeAccountDeletion(calls)).toEqual({ deleted: true, warning: null });
    expect(calls.onDeleted.mock.invocationCallOrder[0]).toBeLessThan(calls.clearBrowserData.mock.invocationCallOrder[0]);
    expect(calls.clearBrowserData.mock.invocationCallOrder[0]).toBeLessThan(calls.signOut.mock.invocationCallOrder[0]);
  });

  it("does not erase browser data when server deletion fails", async () => {
    const calls = actions();
    calls.requestDeletion.mockResolvedValue({ ok: false });
    expect((await completeAccountDeletion(calls)).deleted).toBe(false);
    expect(calls.onDeleted).not.toHaveBeenCalled();
    expect(calls.clearBrowserData).not.toHaveBeenCalled();
    expect(calls.signOut).not.toHaveBeenCalled();
  });

  it("does not claim nothing was removed after a lost deletion response", async () => {
    const calls = actions();
    calls.requestDeletion.mockRejectedValue(new Error("Network failure"));
    const result = await completeAccountDeletion(calls);
    expect(result.deleted).toBe(false);
    expect(result.warning).toContain("could not be confirmed");
    expect(result.warning).not.toContain("Nothing was removed");
  });

  it("reports successful deletion accurately even when sign-out fails", async () => {
    const calls = actions();
    calls.signOut.mockRejectedValue(new Error("Network failure"));
    const result = await completeAccountDeletion(calls);
    expect(result.deleted).toBe(true);
    expect(result.warning).toContain("account was deleted and browser data cleared");
  });

  it("keeps a browser-cleanup failure visible instead of redirecting", async () => {
    const calls = actions();
    calls.clearBrowserData.mockImplementation(() => { throw new Error("Storage blocked"); });
    const result = await completeAccountDeletion(calls);
    expect(result.deleted).toBe(true);
    expect(result.warning).toContain("Clear this site's browser data");
    expect(calls.signOut).not.toHaveBeenCalled();
  });

  it("clears only the deleted user's keys and old unscoped keys", () => {
    const data = new Map([
      [storageKeyForUser("user-a", "scan-history"), "private scan"],
      [storageKeyForUser("user-a", "finding-status-overrides"), "statuses"],
      [storageKeyForUser("user-a", "finding-status-reasons"), "reasons"],
      ["vibe:scan-history", "legacy scan"],
      ["vibe:finding-status-overrides", "legacy statuses"],
      ["vibe:finding-status-reasons", "legacy reasons"],
      [storageKeyForUser("user-b", "scan-history"), "other account"],
      ["unrelated", "keep"],
    ]);
    clearBrowserAccountData({ removeItem: (key) => { data.delete(key); } }, "user-a");
    expect([...data.entries()]).toEqual([
      [storageKeyForUser("user-b", "scan-history"), "other account"],
      ["unrelated", "keep"],
    ]);
  });

  it("attempts all removals even if browser storage rejects one key", () => {
    const removeItem = vi.fn((key: string) => {
      if (key === storageKeyForUser("user-a", "scan-history")) throw new Error("Blocked");
    });
    expect(() => clearBrowserAccountData({ removeItem }, "user-a")).toThrow("could not be fully cleared");
    expect(removeItem).toHaveBeenCalledTimes(6);
    expect(removeItem).toHaveBeenCalledWith(storageKeyForUser("user-a", "finding-status-reasons"));
  });
});
