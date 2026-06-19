import { PrismaClient } from "@prisma/client";

// Standard Node Prisma client over SQLite (DATABASE_URL=file:...). Reused across
// requests; cached on globalThis in dev so Next's hot-reload doesn't leak a new
// connection per reload.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

// Kept async so existing `await getPrisma()` call sites stay unchanged. There is
// no per-request binding anymore (that was the Cloudflare D1 model) — this just
// returns the shared singleton.
export async function getPrisma(): Promise<PrismaClient> {
  return prisma;
}
