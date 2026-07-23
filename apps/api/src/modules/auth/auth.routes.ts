import { Router } from 'express';
import {
  acceptInviteSchema,
  beginMfaEnrollmentSchema,
  confirmMfaEnrollmentSchema,
  disableMfaSchema,
  forgotPasswordSchema,
  loginSchema,
  registerOrgSchema,
  resetPasswordSchema,
  verifyMfaSchema,
} from '@hrms/shared';
import { validate } from '../../common/middleware/validate';
import { authRateLimit } from '../../common/middleware/security';
import { requireAuth } from '../../common/middleware/rbac';
import * as ctrl from './auth.controller';

export const authRouter = Router();

authRouter.use(authRateLimit);

// Public
authRouter.post('/login', validate({ body: loginSchema }), ctrl.login);
authRouter.post('/mfa/verify', validate({ body: verifyMfaSchema }), ctrl.verifyMfa);
authRouter.post('/register-org', validate({ body: registerOrgSchema }), ctrl.registerOrg);
authRouter.post('/accept-invite', validate({ body: acceptInviteSchema }), ctrl.acceptInvite);
authRouter.post('/forgot-password', validate({ body: forgotPasswordSchema }), ctrl.forgotPassword);
authRouter.post('/reset-password', validate({ body: resetPasswordSchema }), ctrl.resetPassword);
authRouter.post('/refresh', ctrl.refresh);
authRouter.post('/logout', ctrl.logout);

// Authenticated
authRouter.get('/me', requireAuth, ctrl.me);
authRouter.post('/mfa/begin', requireAuth, validate({ body: beginMfaEnrollmentSchema }), ctrl.mfaBegin);
authRouter.post('/mfa/confirm', requireAuth, validate({ body: confirmMfaEnrollmentSchema }), ctrl.mfaConfirm);
authRouter.post('/mfa/disable', requireAuth, validate({ body: disableMfaSchema }), ctrl.mfaDisable);
