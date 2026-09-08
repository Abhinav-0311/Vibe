import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

export function isDatabaseConfigured() {
  return Boolean(process.env.DATABASE_URL);
}

export function getPrisma() {
  if (!isDatabaseConfigured()) return null;

  const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL,
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
