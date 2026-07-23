import { z } from 'zod';
import type { NextFunction, Request, Response } from 'express';

/**
 * Application error with a stable `code`, HTTP status, and optional details.
 * Thrown anywhere in services; the central error handler converts to JSON.
 */
export class HttpError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly details?: Record<string, unknown>;

  constructor(statusCode: number, code: string, message: string, details?: Record<string, unknown>) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    Object.setPrototypeOf(this, HttpError.prototype);
  }

  static badRequest(message = 'Bad request', details?: Record<string, unknown>) {
    return new HttpError(400, 'bad_request', message, details);
  }
  static unauthorized(message = 'Unauthorized', code = 'unauthorized') {
    return new HttpError(401, code, message);
  }
  static forbidden(message = 'Forbidden', code = 'forbidden') {
    return new HttpError(403, code, message);
  }
  static notFound(message = 'Not found', code = 'not_found') {
    return new HttpError(404, code, message);
  }
  static conflict(message = 'Conflict', code = 'conflict') {
    return new HttpError(409, code, message);
  }
  static unprocessable(message = 'Unprocessable entity', code = 'unprocessable') {
    return new HttpError(422, code, message);
  }
  static internal(message = 'Internal server error', code = 'internal_error') {
    return new HttpError(500, code, message);
  }
}

export class ValidationError extends HttpError {
  constructor(details: Record<string, unknown>) {
    super(400, 'validation_error', 'Request validation failed', details);
  }
}

/** Safely assert a value is present; throws HttpError(500) otherwise. */
export function assertDefined<T>(value: T | undefined | null, message = 'Required value missing'): T {
  if (value === undefined || value === null) {
    throw HttpError.internal(message);
  }
  return value;
}

/** Zod-safe parse that converts errors into a 400 ValidationError. */
export function parseOrThrow<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw new ValidationError(
      result.error.flatten() as unknown as Record<string, unknown>,
    );
  }
  return result.data;
}

/** Wrap an async controller so rejected promises hit the error middleware. */
export const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
