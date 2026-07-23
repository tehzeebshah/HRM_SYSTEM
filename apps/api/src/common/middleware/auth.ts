import type { RequestHandler } from 'express';
import { env } from '../../config/env';
import { prisma } from '../../config/prisma';
import { redis } from '../../config/redis';
import { HttpError } from '../errors';
import { verifyAccessToken, verifyRefreshToken } from '../jwt';
import { hashToken } from '../crypto';
import type { AccessTokenPayload } from '@hrms/shared';

const REFRESH_COOKIE = 'hrms_refresh';
const REVOCATION_KEY = (jti: string) => `revoked:refresh:${jti}`;

export const REFRESH_COOKIE_NAME = REFRESH_COOKIE;

/** Issues and writes the refresh-token cookie — centralizes cookie attributes. */
export function setRefreshCookie(res: Parameters<RequestHandler>[1], token: string, expiresAt: Date) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (res as any).cookie(REFRESH_COOKIE, token, {
    httpOnly: true,
    secure: env.COOKIE_SECURE,
    sameSite: 'strict',
    domain: env.COOKIE_DOMAIN,
    path: '/api/auth',
    expires: expiresAt,
  });
}

export function clearRefreshCookie(res: Parameters<RequestHandler>[1]) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (res as any).clearCookie(REFRESH_COOKIE, {
    httpOnly: true,
    secure: env.COOKIE_SECURE,
    sameSite: 'strict',
    domain: env.COOKIE_DOMAIN,
    path: '/api/auth',
  });
}

/**
 * Authenticates a request by verifying the Bearer access token and loading the
 * user's current membership in the token's tenant. Sets `req.auth`.
 *
 * Fails with 401 if: token missing/invalid, user suspended, membership revoked,
 * or the token has been globally revoked.
 */
export const authenticate: RequestHandler = async (req, _res, next) => {
  try {
    const header = req.headers.authorization;
    if (!header?.toLowerCase().startsWith('bearer ')) {
      throw HttpError.unauthorized('Missing or malformed Authorization header.', 'missing_token');
    }

    const token = header.slice(7).trim();
    let payload: AccessTokenPayload;
    try {
      payload = verifyAccessToken(token);
    } catch {
      throw HttpError.unauthorized('Access token is invalid or expired.', 'invalid_token');
    }

    if (!payload.mfaVerified) {
      throw HttpError.unauthorized('MFA verification required.', 'mfa_required');
    }

    // Ensure the user/membership still exist and are active (handles logout/suspension).
    const membership = await prisma.tenantMembership.findFirst({
      where: { userId: payload.sub, tenantId: payload.tenantId },
      select: {
        status: true,
        role: { select: { code: true } },
        user: { select: { status: true } },
      },
    });

    if (!membership || membership.status !== 'active' || membership.user.status !== 'active') {
      throw HttpError.unauthorized('Session is no longer valid.', 'session_revoked');
    }

    req.auth = {
      userId: payload.sub,
      tenantId: payload.tenantId,
      role: membership.role.code as AccessTokenPayload['role'],
      permissions: payload.permissions,
      mfaVerified: payload.mfaVerified,
    };
    req.tenantId = payload.tenantId;
    next();
  } catch (err) {
    next(err);
  }
};

/** Soft-auth: attaches `req.auth` if a valid token is present, but never fails. */
export const optionalAuth: RequestHandler = (req, _res, next) => {
  const header = req.headers.authorization;
  if (!header?.toLowerCase().startsWith('bearer ')) return next();
  try {
    const payload = verifyAccessToken(header.slice(7).trim());
    if (payload.mfaVerified) {
      req.auth = {
        userId: payload.sub,
        tenantId: payload.tenantId,
        role: payload.role,
        permissions: payload.permissions,
        mfaVerified: payload.mfaVerified,
      };
      req.tenantId = payload.tenantId;
    }
  } catch {
    // ignore — optional
  }
  next();
};

/** Checks a refresh token's validity + revocation state, returns its DB record. */
export async function consumeRefreshToken(token: string) {
  let payload;
  try {
    payload = verifyRefreshToken(token);
  } catch {
    throw HttpError.unauthorized('Refresh token is invalid or expired.', 'invalid_refresh');
  }

  const revoked = await redis.get(REVOCATION_KEY(payload.jti));
  if (revoked) throw HttpError.unauthorized('Refresh token has been revoked.', 'revoked_refresh');

  const stored = await prisma.refreshToken.findUnique({
    where: { jti: payload.jti },
    select: { id: true, hash: true, expiresAt: true, revokedAt: true, userId: true, tenantId: true },
  });

  if (!stored) throw HttpError.unauthorized('Refresh token not recognised.', 'invalid_refresh');
  if (stored.revokedAt) throw HttpError.unauthorized('Refresh token has been revoked.', 'revoked_refresh');
  if (stored.expiresAt < new Date()) throw HttpError.unauthorized('Refresh token expired.', 'expired_refresh');
  if (stored.hash !== hashToken(token)) throw HttpError.unauthorized('Refresh token mismatch.', 'invalid_refresh');

  return stored;
}
