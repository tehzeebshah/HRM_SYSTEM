import IORedis, { type Redis } from 'ioredis';
import { env } from './env';

/**
 * Shared Redis connection used for:
 *  - refresh-token revocation list / rotation tracking
 *  - BullMQ queues (auth emails, payroll runs)
 *  - rate-limit store
 */
const globalForRedis = globalThis as unknown as { hrmsRedis?: Redis };

export const redis: Redis =
  globalForRedis.hrmsRedis ??
  new IORedis(env.REDIS_URL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
    lazyConnect: false,
  });

if (process.env.NODE_ENV !== 'production') {
  globalForRedis.hrmsRedis = redis;
}
