import type { RequestHandler } from 'express';
import { prisma } from '../../config/prisma';
import { HttpError } from '../errors';
import { logger } from '../../config/logger';

/**
 * Resolves the active tenant for a request.
 *
 * Resolution order (first match wins):
 *   1. `tenantId` claim on a verified access token (set by auth.middleware)
 *   2. `X-Tenant` header (UUID)
 *   3. subdomain of the Host header (e.g. acme.hrms.com → "acme")
 *
 * Attaches `req.tenantId`. Tenant-scoped repositories always filter on this.
 * Use `requireTenant` for routes that need a tenant even before auth (rare);
 * most authenticated routes already get it from the token.
 */
export const resolveTenant: RequestHandler = async (req, _res, next) => {
  try {
    let tenantId: string | undefined =
      (req.headers['x-tenant'] as string | undefined) ?? req.tenantId;

    if (!tenantId) {
      const host = req.headers.host ?? '';
      const sub = host.split('.')[0]?.toLowerCase();
      if (sub && sub !== 'www' && !/^\d+\.\d+\.\d+\.\d+/.test(host) && !sub.includes('localhost')) {
        const byDomain = await prisma.tenantDomain.findUnique({
          where: { domain: host },
          select: { tenantId: true, verified: true },
        });
        if (byDomain?.verified) tenantId = byDomain.tenantId;
      }
    }

    if (tenantId && !/^[0-9a-f-]{36}$/i.test(tenantId)) {
      throw HttpError.badRequest('Invalid tenant identifier.');
    }

    req.tenantId = tenantId;
    next();
  } catch (err) {
    next(err);
  }
};

/** Middleware that fails if no tenant could be resolved. */
export const requireTenant: RequestHandler = (req, _res, next) => {
  if (!req.tenantId) {
    return next(HttpError.badRequest('Tenant context is required.', { hint: 'Provide X-Tenant header.' }));
  }
  next();
};

// re-exported for clarity in route files
export { logger };
