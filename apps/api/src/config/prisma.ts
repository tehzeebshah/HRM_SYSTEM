import { PrismaClient } from '../../prisma/generated';

/**
 * Single shared Prisma client. In dev we store it on globalThis so HMR / tsx
 * watch mode does not exhaust DB connections by instantiating new clients.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
