import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

export function isDatabaseConfigured() {
  return Boolean(process.env.DATABASE_URL);
}

export function databaseConnectionString(value: string) {
  const url = new URL(value);
  // Preserve pg 8's certificate verification when its SSL aliases change in pg 9.
  if (["prefer", "require", "verify-ca"].includes(url.searchParams.get("sslmode") ?? "") && url.searchParams.get("uselibpqcompat") !== "true") {
    url.searchParams.set("sslmode", "verify-full");
    return url.toString();
  }
  return value;
}

export function getPrisma() {
  if (!isDatabaseConfigured()) return null;

  const adapter = new PrismaPg({
    connectionString: databaseConnectionString(process.env.DATABASE_URL!),
  });
  const prisma =
    globalForPrisma.prisma ??
    new PrismaClient({
      adapter,
      log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
    });

  // Serverless route handlers can share a runtime between requests. Reusing
  // the client prevents each handler invocation from opening another pool.
  globalForPrisma.prisma = prisma;

  return prisma;
}
