import jwt, { type JwtPayload } from 'jsonwebtoken';
import { env } from '../config/env';
import type { AccessTokenPayload, RefreshTokenPayload } from '@hrms/shared';

export function signAccessToken(payload: Omit<AccessTokenPayload, 'iat' | 'exp'>): string {
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, {
    expiresIn: ttlToSeconds(env.JWT_ACCESS_TTL),
    issuer: env.JWT_ISSUER,
  });
}

export function signRefreshToken(payload: Omit<RefreshTokenPayload, 'iat' | 'exp'>): string {
  return jwt.sign(payload, env.JWT_REFRESH_SECRET, {
    expiresIn: ttlToSeconds(env.JWT_REFRESH_TTL),
    issuer: env.JWT_ISSUER,
  });
}

export function signChallengeToken(payload: {
  sub: string;
  tenantId: string;
}): string {
  return jwt.sign(payload, env.JWT_CHALLENGE_SECRET, {
    expiresIn: ttlToSeconds(env.JWT_CHALLENGE_TTL),
    issuer: env.JWT_ISSUER,
  });
}

export function verifyAccessToken(token: string): AccessTokenPayload & JwtPayload {
  return jwt.verify(token, env.JWT_ACCESS_SECRET, { issuer: env.JWT_ISSUER }) as AccessTokenPayload &
    JwtPayload;
}

export function verifyRefreshToken(token: string): RefreshTokenPayload & JwtPayload {
  return jwt.verify(token, env.JWT_REFRESH_SECRET, { issuer: env.JWT_ISSUER }) as RefreshTokenPayload &
    JwtPayload;
}

export function verifyChallengeToken(token: string): { sub: string; tenantId: string } & JwtPayload {
  return jwt.verify(token, env.JWT_CHALLENGE_SECRET, { issuer: env.JWT_ISSUER }) as {
    sub: string;
    tenantId: string;
  } & JwtPayload;
}

/** Decode a JWT without verifying — used only for extracting `jti` on revoked tokens. */
export function decode<T = JwtPayload>(token: string): T | null {
  return jwt.decode(token) as T | null;
}

/** Parse an `expiresIn` like "7d" / "15m" into seconds. */
export function ttlToSeconds(ttl: string): number {
  const match = /^(\d+)\s*([smhd])$/.exec(ttl.trim());
  if (!match) return 900;
  const value = Number(match[1]);
  const unit = match[2] ?? 'm';
  const multipliers: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86400 };
  return value * (multipliers[unit] ?? 60);
}
