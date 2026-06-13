import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { defineConfig, env } from "prisma/config";

function loadLocalEnv() {
  const envPath = join(process.cwd(), ".env");

  if (!existsSync(envPath)) return;

  const lines = readFileSync(envPath, "utf8").split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#")) continue;

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) continue;

    const key = trimmed.slice(0, separatorIndex);
    const value = trimmed.slice(separatorIndex + 1).replace(/^["']|["']$/g, "");

    process.env[key] ??= value;
  }
}

loadLocalEnv();

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: env("DATABASE_URL"),
  },
});
