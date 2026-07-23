import { authenticator } from '@otplib/preset-default';
import { encrypt, decrypt } from '../../common/crypto';
import { HttpError } from '../../common/errors';

/**
 * TOTP-based MFA. The shared secret is stored encrypted at rest; we never log
 * or expose it. Uses RFC 6238 (30s window, 6 digits).
 */

export interface MfaEnrollment {
  secret: string;
  otpauthUrl: string;
}

/** Generate a new secret + otpauth URI for enrollment. */
export function beginEnrollment(email: string, issuer = 'HRMS'): MfaEnrollment {
  const secret = authenticator.generateSecret();
  const otpauthUrl = authenticator.keyuri(email, issuer, secret);
  return { secret, otpauthUrl };
}

/** Encrypt a secret before persisting. */
export function storeSecret(secret: string): string {
  return encrypt(secret);
}

/** Decrypt a stored secret for verification. */
export function loadSecret(stored: string): string {
  return decrypt(stored);
}

/** Verify a 6-digit code against a stored (encrypted) secret. */
export function verifyCode(storedEncrypted: string, code: string): boolean {
  let secret: string;
  try {
    secret = loadSecret(storedEncrypted);
  } catch {
    throw HttpError.internal('MFA secret is corrupt.');
  }
  // authenticator.check returns boolean; window=1 allows ~30s clock drift.
  const delta = authenticator.verify({ token: code, secret });
  return delta;
}

/** Validate a code against a plaintext secret (used during enrollment confirmation). */
export function verifyCodePlain(secret: string, code: string): boolean {
  return authenticator.verify({ token: code, secret });
}
