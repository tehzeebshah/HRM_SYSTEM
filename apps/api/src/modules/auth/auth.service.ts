import { prisma } from '../../config/prisma';
import { env } from '../../config/env';
import { HttpError } from '../../common/errors';
import { hashPassword, verifyPassword } from '../../common/password';
import { generateToken, hashToken } from '../../common/crypto';
import { signChallengeToken, verifyChallengeToken } from '../../common/jwt';
import {
  DEFAULT_ROLE_PERMISSIONS,
  RoleCode,
  type Permission,
} from '@hrms/shared';
import { sendInvitationEmail, sendPasswordResetEmail } from './mail.service';
import { beginEnrollment, loadSecret, storeSecret, verifyCode, verifyCodePlain } from './mfa.service';
import { issueSession, revokeRefreshToken, isRefreshRevoked } from './token.service';
import type { AuthResponse } from '@hrms/shared';

const INVITATION_TTL_DAYS = 7;
const RESET_TTL_MINUTES = 30;

// ---------------------------------------------------------------------
//  LOGIN
// ---------------------------------------------------------------------

interface LoginResult {
  requiresMfa: boolean;
  challengeToken?: string;
  response?: AuthResponse;
  refreshToken?: string;
  refreshExpiresAt?: Date;
}

/**
 * Step 1 of login. Validates credentials. If the user has MFA enabled, returns
 * a short-lived challenge token the client must exchange via `verifyMfa`.
 */
export async function login(
  email: string,
  password: string,
  tenantHint: string | undefined,
  client: { userAgent?: string | null; ip?: string | null },
): Promise<LoginResult> {
  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      avatarUrl: true,
      passwordHash: true,
      status: true,
      mfaEnabled: true,
      mfaSecretEnc: true,
      failedAttempts: true,
      lockedUntil: true,
      memberships: {
        where: { status: 'active' },
        select: {
          tenantId: true,
          roleId: true,
          role: { select: { code: true } },
          tenant: { select: { id: true, name: true, status: true } },
        },
      },
    },
  });

  if (!user || user.memberships.length === 0) {
    // Constant-time-ish failure: still run a bcrypt hash to reduce timing oracle.
    await verifyPassword(password, '$2b$12$ooooooooooooooooooooooooooooooooooooooooooooo');
    throw HttpError.unauthorized('Invalid email or password.', 'invalid_credentials');
  }

  if (user.status !== 'active') {
    throw HttpError.forbidden('Your account is suspended. Contact your administrator.', 'account_suspended');
  }
  if (user.lockedUntil && user.lockedUntil > new Date()) {
    throw HttpError.forbidden('Too many failed attempts. Try again later.', 'account_locked');
  }

  const passwordOk = await verifyPassword(password, user.passwordHash);
  if (!passwordOk) {
    await registerFailedAttempt(user.id, user.failedAttempts);
    throw HttpError.unauthorized('Invalid email or password.', 'invalid_credentials');
  }

  // Reset failure counter on success.
  if (user.failedAttempts > 0) {
    await prisma.user.update({ where: { id: user.id }, data: { failedAttempts: 0 } });
  }

  // Choose the membership. Prefer the hinted tenant, else the first.
  const membership =
    (tenantHint && user.memberships.find((m) => m.tenantId === tenantHint)) || user.memberships[0];
  if (!membership) {
    throw HttpError.unauthorized('No active membership found.', 'no_membership');
  }

  if (membership.tenant.status !== 'active') {
    throw HttpError.forbidden('This organization is not active.', 'tenant_inactive');
  }

  // Load role + tenant name for session issuance.
  const fullMembership = await prisma.tenantMembership.findFirstOrThrow({
    where: { userId: user.id, tenantId: membership.tenantId },
    include: { role: true },
  });

  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

  if (user.mfaEnabled && user.mfaSecretEnc) {
    const challengeToken = signChallengeToken({ sub: user.id, tenantId: membership.tenantId });
    return { requiresMfa: true, challengeToken };
  }

  const session = await issueSession(
    { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName, avatarUrl: user.avatarUrl },
    fullMembership,
    { id: membership.tenant.id, name: membership.tenant.name, role: membership.role.code },
    client,
    { mfaVerified: true },
  );

  return {
    requiresMfa: false,
    response: session.response,
    refreshToken: session.refreshToken,
    refreshExpiresAt: session.refreshExpiresAt,
  };
}

async function registerFailedAttempt(userId: string, current: number): Promise<void> {
  const next = current + 1;
  const lock = next >= env.ACCOUNT_LOCK_THRESHOLD;
  await prisma.user.update({
    where: { id: userId },
    data: {
      failedAttempts: next,
      lockedUntil: lock ? new Date(Date.now() + env.ACCOUNT_LOCK_MINUTES * 60_000) : null,
    },
  });
}

// ---------------------------------------------------------------------
//  MFA VERIFY
// ---------------------------------------------------------------------

export async function verifyMfa(
  challengeToken: string,
  code: string,
  client: { userAgent?: string | null; ip?: string | null },
): Promise<{ response: AuthResponse; refreshToken: string; refreshExpiresAt: Date }> {
  let payload;
  try {
    payload = verifyChallengeToken(challengeToken);
  } catch {
    throw HttpError.unauthorized('Challenge token is invalid or expired.', 'invalid_challenge');
  }

  const user = await prisma.user.findUniqueOrThrow({
    where: { id: payload.sub },
    select: { id: true, email: true, firstName: true, lastName: true, avatarUrl: true, mfaSecretEnc: true, mfaEnabled: true },
  });

  if (!user.mfaEnabled || !user.mfaSecretEnc) {
    throw HttpError.badRequest('MFA is not enabled for this account.');
  }

  if (!verifyCode(user.mfaSecretEnc, code)) {
    throw HttpError.unauthorized('Invalid MFA code.', 'invalid_mfa_code');
  }

  const membership = await prisma.tenantMembership.findFirstOrThrow({
    where: { userId: user.id, tenantId: payload.tenantId },
    include: { role: true, tenant: { select: { id: true, name: true } } },
  });

  const session = await issueSession(
    { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName, avatarUrl: user.avatarUrl },
    membership,
    { id: membership.tenant.id, name: membership.tenant.name, role: membership.role.code },
    client,
    { mfaVerified: true },
  );

  return { response: session.response, refreshToken: session.refreshToken, refreshExpiresAt: session.refreshExpiresAt };
}

// ---------------------------------------------------------------------
//  MFA ENROLLMENT (self-service, requires authenticated user)
// ---------------------------------------------------------------------

export async function beginMfaEnrollment(userId: string) {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { email: true, mfaEnabled: true },
  });
  if (user.mfaEnabled) throw HttpError.conflict('MFA is already enabled.');

  const { secret, otpauthUrl } = beginEnrollment(user.email);
  // NOTE: secret is returned to the client ONLY during enrollment confirmation.
  // We do NOT persist it until `confirmMfaEnrollment` succeeds.
  return { secret, otpauthUrl };
}

export async function confirmMfaEnrollment(userId: string, secret: string, code: string) {
  if (!verifyCodePlain(secret, code)) {
    throw HttpError.unauthorized('Invalid MFA code. Enrollment aborted.', 'invalid_mfa_code');
  }
  await prisma.user.update({
    where: { id: userId },
    data: { mfaEnabled: true, mfaSecretEnc: storeSecret(secret) },
  });
  return { enabled: true };
}

export async function disableMfa(userId: string, password: string) {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { passwordHash: true, mfaEnabled: true },
  });
  if (!(await verifyPassword(password, user.passwordHash))) {
    throw HttpError.unauthorized('Password is incorrect.', 'invalid_credentials');
  }
  await prisma.user.update({
    where: { id: userId },
    data: { mfaEnabled: false, mfaSecretEnc: null },
  });
  // Revoke all active sessions — user must log in again.
  await prisma.refreshToken.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  return { enabled: false };
}

// ---------------------------------------------------------------------
//  REGISTER ORGANIZATION (self-service tenant signup)
// ---------------------------------------------------------------------

export async function registerOrg(input: {
  companyName: string;
  domain: string;
  ownerFirstName: string;
  ownerLastName: string;
  ownerEmail: string;
  ownerPassword: string;
}): Promise<{ tenantId: string; userId: string }> {
  const existingUser = await prisma.user.findUnique({ where: { email: input.ownerEmail } });
  if (existingUser) throw HttpError.conflict('An account with this email already exists.');

  const existingDomain = await prisma.tenantDomain.findUnique({ where: { domain: input.domain } });
  if (existingDomain) throw HttpError.conflict('This domain is already registered.');

  const passwordHash = await hashPassword(input.ownerPassword);

  // Transaction: tenant + domain + system roles + permissions + owner user + membership.
  const result = await prisma.$transaction(async (tx) => {
    const tenant = await tx.tenant.create({
      data: { name: input.companyName, domain: input.domain, plan: 'free', status: 'active' },
    });

    await tx.tenantDomain.create({
      data: { tenantId: tenant.id, domain: input.domain, verified: false },
    });

    // Seed system roles + default permission matrix.
    const roleMap = await seedRoles(tx, tenant.id);

    const owner = await tx.user.create({
      data: {
        email: input.ownerEmail,
        passwordHash,
        firstName: input.ownerFirstName,
        lastName: input.ownerLastName,
        status: 'active',
      },
    });

    await tx.tenantMembership.create({
      data: {
        userId: owner.id,
        tenantId: tenant.id,
        roleId: roleMap[RoleCode.ADMIN]!,
        status: 'active',
      },
    });

    return { tenantId: tenant.id, userId: owner.id };
  });

  return result;
}

async function seedRoles(
  tx: Parameters<Parameters<typeof prisma['$transaction']>[0]>[0],
  tenantId: string,
): Promise<Record<string, string>> {
  const map: Record<string, string> = {};
  for (const code of Object.values(RoleCode)) {
    const role = await tx.role.create({
      data: {
        tenantId,
        code,
        name: code.charAt(0).toUpperCase() + code.slice(1),
        isSystem: true,
      },
    });
    map[code] = role.id;
  }

  // Seed permissions catalog if empty, then attach to roles.
  for (const [group, codes] of Object.entries(permissionGroups)) {
    for (const code of codes) {
      const perm = await tx.permission.upsert({
        where: { code },
        update: {},
        create: { code, name: code, group },
      });
      // Attach to roles per the default matrix.
      for (const [roleCode, perms] of Object.entries(DEFAULT_ROLE_PERMISSIONS)) {
        if ((perms as readonly string[]).includes(code)) {
          await tx.rolePermission.upsert({
            where: { roleId_permissionId: { roleId: map[roleCode]!, permissionId: perm.id } },
            update: {},
            create: { roleId: map[roleCode]!, permissionId: perm.id },
          });
        }
      }
    }
  }
  return map;
}

// Grouped for the permissions catalog UI later.
const permissionGroups: Record<string, Permission[]> = {
  employee: [
    'employee.view' as Permission,
    'employee.create' as Permission,
    'employee.update' as Permission,
    'employee.delete' as Permission,
  ],
  org: ['org.manage' as Permission],
  attendance: ['attendance.view' as Permission, 'attendance.manage' as Permission, 'attendance.clock' as Permission],
  leave: ['leave.request' as Permission, 'leave.approve' as Permission, 'leave.manage' as Permission],
  payroll: ['payroll.view_own' as Permission, 'payroll.view_all' as Permission, 'payroll.run' as Permission, 'payroll.manage' as Permission],
  performance: ['performance.view' as Permission, 'performance.manage' as Permission],
  recruit: ['recruit.view' as Permission, 'recruit.manage' as Permission],
  asset: ['asset.view' as Permission, 'asset.manage' as Permission],
  engagement: ['engagement.manage' as Permission],
  report: ['report.view' as Permission, 'report.manage' as Permission],
  system: ['tenant.manage' as Permission, 'user.manage' as Permission, 'role.manage' as Permission, 'audit.view' as Permission],
};

// ---------------------------------------------------------------------
//  INVITATIONS
// ---------------------------------------------------------------------

export async function createInvitation(
  tenantId: string,
  inviterId: string,
  email: string,
  roleCode: RoleCode,
): Promise<{ acceptUrl: string }> {
  const role = await prisma.role.findFirst({ where: { tenantId, code: roleCode } });
  if (!role) throw HttpError.badRequest(`Role '${roleCode}' does not exist in this tenant.`);

  const token = generateToken();
  await prisma.invitation.create({
    data: {
      tenantId,
      email: email.toLowerCase(),
      roleId: role.id,
      tokenHash: hashToken(token),
      invitedBy: inviterId,
      expiresAt: new Date(Date.now() + INVITATION_TTL_DAYS * 86_400_000),
    },
  });

  const acceptUrl = `${env.APP_BASE_URL}/accept-invite?token=${token}`;
  const tenant = await prisma.tenant.findUniqueOrThrow({ where: { id: tenantId }, select: { name: true } });
  await sendInvitationEmail(email.toLowerCase(), acceptUrl, tenant.name);
  return { acceptUrl };
}

export async function acceptInvitation(
  token: string,
  firstName: string,
  lastName: string,
  password: string,
): Promise<void> {
  const invitation = await prisma.invitation.findUnique({ where: { tokenHash: hashToken(token) } });
  if (!invitation || invitation.acceptedAt || invitation.expiresAt < new Date()) {
    throw HttpError.badRequest('This invitation is invalid or has expired.');
  }

  const passwordHash = await hashPassword(password);
  await prisma.$transaction(async (tx) => {
    // Reuse existing user if they already have an account (multi-tenant).
    const existing = await tx.user.findUnique({ where: { email: invitation.email } });
    const user =
      existing ??
      (await tx.user.create({
        data: { email: invitation.email, passwordHash, firstName, lastName, status: 'active' },
      }));

    await tx.tenantMembership.upsert({
      where: { userId_tenantId: { userId: user.id, tenantId: invitation.tenantId } },
      update: { roleId: invitation.roleId, status: 'active' },
      create: { userId: user.id, tenantId: invitation.tenantId, roleId: invitation.roleId, status: 'active', invitedBy: invitation.invitedBy },
    });

    await tx.invitation.update({ where: { id: invitation.id }, data: { acceptedAt: new Date() } });
  });
}

// ---------------------------------------------------------------------
//  FORGOT / RESET PASSWORD
// ---------------------------------------------------------------------

export async function forgotPassword(email: string): Promise<void> {
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  // Always return silently — do not leak whether the email exists.
  if (!user) return;

  const token = generateToken();
  await prisma.passwordReset.create({
    data: {
      userId: user.id,
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + RESET_TTL_MINUTES * 60_000),
    },
  });

  const resetUrl = `${env.APP_BASE_URL}/reset-password?token=${token}`;
  await sendPasswordResetEmail(user.email, resetUrl);
}

export async function resetPassword(token: string, password: string): Promise<void> {
  const record = await prisma.passwordReset.findUnique({ where: { tokenHash: hashToken(token) } });
  if (!record || record.usedAt || record.expiresAt < new Date()) {
    throw HttpError.badRequest('This reset link is invalid or has expired.');
  }
  const passwordHash = await hashPassword(password);
  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: record.userId }, data: { passwordHash } });
    await tx.passwordReset.update({ where: { id: record.id }, data: { usedAt: new Date() } });
    // Revoke all sessions.
    await tx.refreshToken.updateMany({
      where: { userId: record.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  });
}

// ---------------------------------------------------------------------
//  REFRESH / LOGOUT
// ---------------------------------------------------------------------

export async function refreshSession(
  refreshToken: string,
  client: { userAgent?: string | null; ip?: string | null },
): Promise<{ response: AuthResponse; newRefreshToken: string; refreshExpiresAt: Date; oldJti: string }> {
  const { verifyRefreshToken } = await import('../../common/jwt');
  let payload;
  try {
    payload = verifyRefreshToken(refreshToken);
  } catch {
    throw HttpError.unauthorized('Refresh token is invalid or expired.', 'invalid_refresh');
  }

  if (await isRefreshRevoked(payload.jti)) {
    throw HttpError.unauthorized('Refresh token has been revoked.', 'revoked_refresh');
  }

  const stored = await prisma.refreshToken.findUnique({
    where: { jti: payload.jti },
    include: { user: { select: { id: true, email: true, firstName: true, lastName: true, avatarUrl: true, status: true } } },
  });
  if (!stored || stored.revokedAt || stored.expiresAt < new Date() || stored.hash !== hashToken(refreshToken)) {
    throw HttpError.unauthorized('Refresh token is invalid.', 'invalid_refresh');
  }
  if (stored.user.status !== 'active') {
    throw HttpError.forbidden('Account is suspended.', 'account_suspended');
  }

  const membership = await prisma.tenantMembership.findFirstOrThrow({
    where: { userId: stored.userId, tenantId: stored.tenantId, status: 'active' },
    include: { role: true, tenant: { select: { id: true, name: true, status: true } } },
  });
  if (membership.tenant.status !== 'active') {
    throw HttpError.forbidden('Organization is not active.', 'tenant_inactive');
  }

  // Rotate: revoke the old token, issue a new pair.
  await revokeRefreshToken(payload.jti);

  const session = await issueSession(
    stored.user,
    membership,
    { id: membership.tenant.id, name: membership.tenant.name, role: membership.role.code },
    client,
    { mfaVerified: true },
  );

  return {
    response: session.response,
    newRefreshToken: session.refreshToken,
    refreshExpiresAt: session.refreshExpiresAt,
    oldJti: payload.jti,
  };
}

export async function logout(refreshToken: string | undefined): Promise<void> {
  if (!refreshToken) return;
  const { verifyRefreshToken } = await import('../../common/jwt');
  try {
    const payload = verifyRefreshToken(refreshToken);
    await revokeRefreshToken(payload.jti);
  } catch {
    // ignore — token is already invalid
  }
}

export async function getCurrentSession(
  userId: string,
  tenantId: string,
): Promise<{
  user: { id: string; email: string; firstName: string; lastName: string; avatarUrl: string | null };
  tenant: { id: string; name: string; role: string };
  mfaEnabled: boolean;
}> {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { id: true, email: true, firstName: true, lastName: true, avatarUrl: true, mfaEnabled: true },
  });
  const membership = await prisma.tenantMembership.findFirstOrThrow({
    where: { userId, tenantId },
    include: { role: true, tenant: { select: { id: true, name: true } } },
  });
  return {
    user: {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      avatarUrl: user.avatarUrl,
    },
    tenant: { id: membership.tenant.id, name: membership.tenant.name, role: membership.role.code },
    mfaEnabled: user.mfaEnabled,
  };
}

// keep the unused import referenced (loadSecret used implicitly via verifyCode)
void loadSecret;
