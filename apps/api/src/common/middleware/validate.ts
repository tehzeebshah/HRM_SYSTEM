import type { RequestHandler } from 'express';
import { z } from 'zod';
import { ValidationError } from '../errors';

/**
 * Validate request body / query / params against a zod schema.
 * Usage: router.post('/', validate({ body: loginSchema }), handler)
 */
export function validate(schemas: {
  body?: z.ZodType;
  query?: z.ZodType;
  params?: z.ZodType;
}): RequestHandler {
  return (req, _res, next) => {
    try {
      if (schemas.body) req.body = schemas.body.parse(req.body);
      if (schemas.query) req.query = schemas.query.parse(req.query) as typeof req.query;
      if (schemas.params) req.params = schemas.params.parse(req.params) as typeof req.params;
      next();
    } catch (err) {
      if (err instanceof z.ZodError) {
        next(new ValidationError(err.flatten() as unknown as Record<string, unknown>));
      } else {
        next(err);
      }
    }
  };
}
