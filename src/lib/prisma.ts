import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });

/** Cached on globalThis in every environment, not just dev — on Vercel a
 * "warm" serverless invocation reuses the same module scope, so without this
 * every request would open a brand-new pg connection pool (fresh TCP/TLS
 * handshake to Neon) before running a single query. Caching lets warm
 * invocations reuse the existing pool instead of paying that cost every
 * time, which is most of what made page loads feel slow. */
export const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter });

globalForPrisma.prisma = prisma;
