import { z } from 'zod';

const passwordSchema = z
  .string()
  .min(10, 'Password must be at least 10 characters')
  .max(128, 'Password is too long')
  .regex(/[A-Z]/, 'Must contain an uppercase letter')
  .regex(/[a-z]/, 'Must contain a lowercase letter')
  .regex(/[0-9]/, 'Must contain a digit');

const emailSchema = z.string().trim().toLowerCase().email('Invalid email').max(254);

/** Step 1 of login: email + password. Returns a short-lived challenge token if MFA is enabled. */
export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(128),
  tenantId: z.string().uuid().optional(),
});

export type LoginInput = z.infer<typeof loginSchema>;

/** Step 2 of login (only if user has MFA enrolled): TOTP code. */
export const verifyMfaSchema = z.object({
  challengeToken: z.string().min(1),
  code: z.string().regex(/^\d{6}$/, 'Code must be 6 digits'),
});

export type VerifyMfaInput = z.infer<typeof verifyMfaSchema>;

/** Create a brand-new tenant + owner account (self-service signup). */
export const registerOrgSchema = z.object({
  companyName: z.string().trim().min(2, 'Company name is too short').max(120),
  domain: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9.-]+\.[a-z]{2,}$/i, 'Invalid domain'),
  ownerFirstName: z.string().trim().min(1).max(80),
  ownerLastName: z.string().trim().min(1).max(80),
  ownerEmail: emailSchema,
  ownerPassword: passwordSchema,
});

export type RegisterOrgInput = z.infer<typeof registerOrgSchema>;

/** Accept an invitation to an existing tenant. */
export const acceptInviteSchema = z.object({
  token: z.string().min(1),
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  password: passwordSchema,
});

export type AcceptInviteInput = z.infer<typeof acceptInviteSchema>;

export const forgotPasswordSchema = z.object({
  email: emailSchema,
});

export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: passwordSchema,
});

export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

/** Begin MFA enrollment: returns secret + otpauth URI. */
export const beginMfaEnrollmentSchema = z.object({});

/** Confirm MFA enrollment with a valid TOTP code. */
export const confirmMfaEnrollmentSchema = z.object({
  secret: z.string().min(1),
  code: z.string().regex(/^\d{6}$/, 'Code must be 6 digits'),
});

/** Disable MFA (requires current password re-confirmation). */
export const disableMfaSchema = z.object({
  password: z.string().min(1).max(128),
});

/** Authenticated response shape after a successful login / MFA verify. */
export const authResponseSchema = z.object({
  accessToken: z.string(),
  expiresIn: z.number(),
  user: z.object({
    id: z.string().uuid(),
    email: z.string().email(),
    firstName: z.string(),
    lastName: z.string(),
    avatarUrl: z.string().nullable(),
  }),
  tenant: z.object({
    id: z.string().uuid(),
    name: z.string(),
    role: z.string(),
  }),
});

export type AuthResponse = z.infer<typeof authResponseSchema>;
