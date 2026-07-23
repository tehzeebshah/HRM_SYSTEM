import { randomUUID } from 'crypto';
import { prisma } from '../../config/prisma';
import { redis } from '../../config/redis';
import { env } from '../../config/env';
import { signAccessToken, signRefreshToken, ttlToSeconds } from '../../common/jwt';
import { hashToken } from '../../common/crypto';
import type { AuthResponse, Permission, RoleCode } from '@hrms/shared';
import type { Role, TenantMembership, User } from '../../../prisma/generated';

type SessionUser = Pick<User, 'id' | 'email' | 'firstName' | 'lastName' | 'avatarUrl'>;
type SessionTenant = { id: string; name: string; role: string };

const REFRESH_COOKIE = 'hrms_refresh';
const REVOCATION_KEY = (jti: string) => `revoked:refresh:${jti}`;
export const REFRESH_COOKIE_NAME = REFRESH_COOKIE;
export const REFRESH_COOKIE_PATH = '/api/auth';

/**
 * Issues an access + refresh token pair, persists the refresh token (hashed),
 * and returns the response. Caller is responsible for setting the cookie.
 *
 * Detects attempts to reuse a revoked/rotated refresh token (token family
 * compromise) and revokes the entire family.
 */
export async function issueSession(
  user: SessionUser,
  membership: TenantMembership & { role: Role },
  tenant: SessionTenant,
  client: { userAgent?: string | null; ip?: string | null },
  opts: { mfaVerified: boolean },
): Promise<{ accessToken: string; refreshToken: string; refreshExpiresAt: Date; response: AuthResponse }> {
  const permissions = await loadPermissionCodes(membership.roleId);

  const accessToken = signAccessToken({
    sub: user.id,
    tenantId: membership.tenantId,
    role: membership.role.code as RoleCode,
    permissions: permissions as Permission[],
    mfaVerified: opts.mfaVerified,
  });

  const jti = randomUUID();
  const refreshToken = signRefreshToken({ sub: user.id, tenantId: membership.tenantId, jti });
  const refreshExpiresAt = new Date(Date.now() + ttlToSeconds(env.JWT_REFRESH_TTL) * 1000);

  await prisma.refreshToken.create({
    data: {
      id: randomUUID(),
      userId: user.id,
      tenantId: membership.tenantId,
      jti,
      hash: hashToken(refreshToken),
      userAgent: client.userAgent ?? null,
      ip: client.ip ?? null,
      expiresAt: refreshExpiresAt,
    },
  });

  const response: AuthResponse = {
    accessToken,
    expiresIn: ttlToSeconds(env.JWT_ACCESS_TTL),
    user: {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      avatarUrl: user.avatarUrl ?? null,
    },
    tenant: { id: tenant.id, name: tenant.name, role: tenant.role },
  };

  return { accessToken, refreshToken, refreshExpiresAt, response };
}

/** Marks a refresh token (and its family) revoked; blacklists the jti in Redis. */
export async function revokeRefreshToken(jti: string, replacedBy?: string) {
  await prisma.refreshToken.updateMany({
    where: { jti, revokedAt: null },
    data: { revokedAt: new Date(), replacedBy: replacedBy ?? null },
  });
  const ttl = ttlToSeconds(env.JWT_REFRESH_TTL);
  await redis.set(REVOCATION_KEY(jti), '1', 'EX', ttl);
}

export async function isRefreshRevoked(jti: string): Promise<boolean> {
  return (await redis.get(REVOCATION_KEY(jti))) === '1';
}

async function loadPermissionCodes(roleId: string): Promise<string[]> {
  const rows = await prisma.rolePermission.findMany({
    where: { roleId },
    select: { permission: { select: { code: true } } },
  });
  return rows.map((r: { permission: { code: string } }) => r.permission.code);
}
