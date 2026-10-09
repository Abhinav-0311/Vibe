import { describe, expect, it } from "vitest";
import { databaseConnectionString } from "@/lib/prisma";

describe("PostgreSQL certificate verification", () => {
  it.each(["prefer", "require", "verify-ca"])("preserves strict verification for pg's %s alias", (mode) => {
    const url = new URL(databaseConnectionString(`postgresql://user:p%40ss@db.example/test?sslmode=${mode}&channel_binding=require`));
    expect(url.searchParams.get("sslmode")).toBe("verify-full");
    expect(url.searchParams.get("channel_binding")).toBe("require");
    expect(url.password).toBe("p%40ss");
  });

  it.each([
    "postgresql://postgres@localhost:5433/vibe",
    "postgresql://user@db.example/test?sslmode=verify-full",
    "postgresql://user@db.example/test?sslmode=disable",
    "postgresql://user@db.example/test?sslmode=require&uselibpqcompat=true",
  ])("does not override an explicit or local configuration: %s", (url) => {
    expect(databaseConnectionString(url)).toBe(url);
  });
});
