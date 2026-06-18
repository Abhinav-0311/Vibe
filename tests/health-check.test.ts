import { describe, expect, it, vi } from "vitest";
import { checkHealth } from "@/lib/health/health-check";

describe("health check", () => {
  it("reports degraded health when PostgreSQL is not configured", async () => {
    const checkDatabase = vi.fn();
    const result = await checkHealth({ databaseConfigured: false, checkDatabase });

    expect(result).toEqual({
      status: "degraded",
      checks: { application: "ok", database: "not_configured" },
    });
    expect(checkDatabase).not.toHaveBeenCalled();
  });

  it("reports healthy only after the database probe succeeds", async () => {
    const result = await checkHealth({ databaseConfigured: true, checkDatabase: async () => undefined });
    expect(result.status).toBe("ok");
    expect(result.checks.database).toBe("ok");
  });

  it("reports degraded health without leaking database errors", async () => {
    const result = await checkHealth({
      databaseConfigured: true,
      checkDatabase: async () => { throw new Error("postgresql://secret@host/database"); },
    });

    expect(result).toEqual({
      status: "degraded",
      checks: { application: "ok", database: "error" },
    });
    expect(JSON.stringify(result)).not.toContain("secret");
  });
});
