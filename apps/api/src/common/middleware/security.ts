import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import type { RequestHandler } from 'express';
import { corsOrigins, env, isProd } from '../../config/env';

export const securityHelmet = helmet({
  contentSecurityPolicy: isProd
    ? undefined
    : {
        useDefaults: true,
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'"], // Vite dev
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:', 'blob:'],
          connectSrc: ["'self'", 'http://localhost:*', 'ws://localhost:*'],
        },
      },
  crossOriginEmbedderPolicy: false,
});

export const corsMiddleware = cors({
  origin(origin, cb) {
    if (!origin || corsOrigins.includes(origin)) return cb(null, true);
    return cb(new Error(`Origin ${origin} not allowed by CORS`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Tenant', 'Idempotency-Key'],
  exposedHeaders: ['X-Total-Count'],
});

export const globalRateLimit: RequestHandler = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  // In-memory store is fine behind a single instance; swap for Redis store for HA.
  message: { error: { code: 'rate_limited', message: 'Too many requests, slow down.' } },
});

/** Stricter limiter used on auth endpoints to blunt credential stuffing. */
export const authRateLimit: RequestHandler = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: 'rate_limited', message: 'Too many authentication attempts.' } },
});

export const compressionMiddleware: RequestHandler = (req, res, next) => {
  // Lazy-load compression to keep cold start light if not needed.
  import('compression').then(({ default: compression }) => compression()(req, res, next));
};
