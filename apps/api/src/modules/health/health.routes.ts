import { Router } from 'express';
import type { Request, Response } from 'express';
import { prisma } from '../../config/prisma';
import { redis } from '../../config/redis';
import { ok } from '../../common/response';
import { env } from '../../config/env';

export const healthRouter = Router();

/**
 * Lightweight liveness/readiness probe.
 * Returns dependencies' status. Used by Docker HEALTHCHECK and uptime monitors.
 */
healthRouter.get('/health', async (_req: Request, res: Response) => {
  const checks = {
    api: 'ok',
    db: 'ok' as 'ok' | 'error',
    redis: 'ok' as 'ok' | 'error',
    time: new Date().toISOString(),
    env: env.NODE_ENV,
  };

  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    checks.db = 'error';
  }

  try {
    const pong = await redis.ping();
    if (pong !== 'PONG') checks.redis = 'error';
  } catch {
    checks.redis = 'error';
  }

  const healthy = checks.db === 'ok' && checks.redis === 'ok';
  return res.status(healthy ? 200 : 503).json({
    status: healthy ? 'ok' : 'degraded',
    checks,
  });
});
