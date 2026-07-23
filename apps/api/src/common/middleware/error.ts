import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { Prisma } from '../../../prisma/generated';
import { HttpError, ValidationError } from '../errors';
import { logger } from '../../config/logger';
import { env } from '../../config/env';

/** Central error handler — the last middleware in the chain. */
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof HttpError) {
    if (err.statusCode >= 500) {
      logger.error({ err }, 'HTTP error');
    }
    return res.status(err.statusCode).json({ error: { code: err.code, message: err.message, details: err.details } });
  }

  if (err instanceof ZodError) {
    return res.status(400).json({
      error: { code: 'validation_error', message: 'Request validation failed', details: err.flatten() },
    });
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    // P2002 = unique constraint violation
    if (err.code === 'P2002') {
      const target = (err.meta?.target as string[] | undefined)?.join(', ') ?? 'field';
      return res
        .status(409)
        .json({ error: { code: 'conflict', message: `A record with this ${target} already exists.` } });
    }
    // P2025 = record not found
    if (err.code === 'P2025') {
      return res.status(404).json({ error: { code: 'not_found', message: 'Record not found.' } });
    }
    logger.error({ err }, 'Prisma error');
    return res.status(400).json({ error: { code: 'database_error', message: 'Database operation failed.' } });
  }

  logger.error({ err }, 'Unhandled error');
  return res.status(500).json({
    error: {
      code: 'internal_error',
      message: env.NODE_ENV === 'production' ? 'Internal server error' : (err as Error)?.message ?? 'Unknown error',
    },
  });
}

export function notFoundHandler(_req: Request, res: Response) {
  res.status(404).json({ error: { code: 'not_found', message: 'Resource not found.' } });
}

export { ValidationError };
