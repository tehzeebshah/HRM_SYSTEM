import type { Request, Response } from 'express';
import { env } from '../../config/env';
import { asyncHandler } from '../../common/errors';
import { ok, created } from '../../common/response';
import { REFRESH_COOKIE_NAME, REFRESH_COOKIE_PATH } from './token.service';
import * as authService from './auth.service';

function clientInfo(req: Request) {
  return { userAgent: req.headers['user-agent'] ?? null, ip: req.ip ?? null };
}

function setRefreshCookie(res: Response, token: string, expiresAt: Date) {
  res.cookie(REFRESH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: env.COOKIE_SECURE,
    sameSite: 'strict',
    domain: env.COOKIE_DOMAIN,
    path: REFRESH_COOKIE_PATH,
    expires: expiresAt,
  });
}

function clearRefreshCookie(res: Response) {
  res.clearCookie(REFRESH_COOKIE_NAME, {
    httpOnly: true,
    secure: env.COOKIE_SECURE,
    sameSite: 'strict',
    domain: env.COOKIE_DOMAIN,
    path: REFRESH_COOKIE_PATH,
  });
}

export const login = asyncHandler(async (req, res) => {
  const result = await authService.login(req.body.email, req.body.password, req.body.tenantId, clientInfo(req));
  if (result.requiresMfa) {
    return ok(res, { requiresMfa: true, challengeToken: result.challengeToken });
  }
  setRefreshCookie(res, result.refreshToken!, result.refreshExpiresAt!);
  return ok(res, result.response);
});

export const verifyMfa = asyncHandler(async (req, res) => {
  const result = await authService.verifyMfa(req.body.challengeToken, req.body.code, clientInfo(req));
  setRefreshCookie(res, result.refreshToken, result.refreshExpiresAt);
  return ok(res, result.response);
});

export const registerOrg = asyncHandler(async (req, res) => {
  const result = await authService.registerOrg(req.body);
  return created(res, result);
});

export const acceptInvite = asyncHandler(async (req, res) => {
  await authService.acceptInvitation(req.body.token, req.body.firstName, req.body.lastName, req.body.password);
  return ok(res, { accepted: true });
});

export const forgotPassword = asyncHandler(async (req, res) => {
  await authService.forgotPassword(req.body.email);
  return ok(res, { sent: true });
});

export const resetPassword = asyncHandler(async (req, res) => {
  await authService.resetPassword(req.body.token, req.body.password);
  return ok(res, { reset: true });
});

export const refresh = asyncHandler(async (req, res) => {
  const cookieToken = req.cookies?.[REFRESH_COOKIE_NAME] as string | undefined;
  if (!cookieToken) {
    clearRefreshCookie(res);
    return res.status(401).json({ error: { code: 'invalid_refresh', message: 'No refresh token.' } });
  }
  const result = await authService.refreshSession(cookieToken, clientInfo(req));
  setRefreshCookie(res, result.newRefreshToken, result.refreshExpiresAt);
  return ok(res, result.response);
});

export const logout = asyncHandler(async (req, res) => {
  const cookieToken = req.cookies?.[REFRESH_COOKIE_NAME] as string | undefined;
  await authService.logout(cookieToken);
  clearRefreshCookie(res);
  return ok(res, { loggedOut: true });
});

export const me = asyncHandler(async (req, res) => {
  const session = await authService.getCurrentSession(req.auth!.userId, req.auth!.tenantId);
  // Don't return a fresh access token here; the client already has a valid one.
  return ok(res, {
    user: session.user,
    tenant: session.tenant,
    mfaEnabled: session.mfaEnabled,
  });
});

// ---- MFA self-service (authenticated) ----

export const mfaBegin = asyncHandler(async (req, res) => {
  const result = await authService.beginMfaEnrollment(req.auth!.userId);
  return ok(res, result);
});

export const mfaConfirm = asyncHandler(async (req, res) => {
  const result = await authService.confirmMfaEnrollment(req.auth!.userId, req.body.secret, req.body.code);
  return ok(res, result);
});

export const mfaDisable = asyncHandler(async (req, res) => {
  const result = await authService.disableMfa(req.auth!.userId, req.body.password);
  return ok(res, result);
});
