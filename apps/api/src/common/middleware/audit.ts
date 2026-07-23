import type { NextFunction, Request, Response, RequestHandler } from 'express';
import { Prisma } from '../../../prisma/generated';
import { prisma } from '../../config/prisma';
import { logger } from '../../config/logger';

/**
 * Best-effort audit logging. Records mutations to AuditLog.
 * Attach after auth middleware so we have `req.auth` available.
 *
 * Usage: `router.post('/', audit('employee', 'create'), handler)`
 *
 * Audit failures must never break the request — they are logged only.
 */
export function audit(entity: string, action: string): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction) => {
    // Capture the body before the handler may mutate it.
    const snapshot = safeClone(req.body);
    next();

    // Fire-and-forget after the response. We re-read req to capture handler
    // outputs attached as `req.auditEntityId` / `req.auditAfter`.
    queueMicrotask(async () => {
      try {
        if (!req.auth || !req.tenantId) return;
        await prisma.auditLog.create({
          data: {
            tenantId: req.tenantId,
            userId: req.auth.userId,
            action,
            entity,
            entityId: req.auditEntityId ?? null,
            before: toJsonValue(req.auditBefore ?? snapshot),
            after: toJsonValue(req.auditAfter),
            ip: req.ip,
            userAgent: req.headers['user-agent'] ?? null,
          },
        });
      } catch (err) {
        logger.warn({ err, entity, action }, 'Failed to write audit log');
      }
    });
  };
}

/** Coerce an arbitrary value into Prisma's JSON input type (or undefined). */
function toJsonValue(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === undefined || value === null) return undefined;
  return value as Prisma.InputJsonValue;
}

function safeClone(value: unknown): unknown {
  if (value == null) return undefined;
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return undefined;
  }
}
