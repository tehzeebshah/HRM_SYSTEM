import { createCipheriv, createDecipheriv, createHash, randomBytes, scryptSync } from 'crypto';
import { env } from '../config/env';

const ALGO = 'aes-256-gcm';
const KEY_LENGTH = 32;
const IV_LENGTH = 16;
const TAG_LENGTH = 16;

// Derive a 32-byte key from the access secret (deterministic per environment).
const key = scryptSync(env.JWT_ACCESS_SECRET, 'hrms-pii-salt', KEY_LENGTH);

/**
 * Symmetric encryption for sensitive PII / secrets at rest (MFA secret, bank
 * account numbers, id numbers). Returns a single base64 string containing
 * iv + ciphertext + auth tag.
 */
export function encrypt(plaintext: string): string {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGO, key, iv);
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString('base64');
}

export function decrypt(payload: string): string {
  const buf = Buffer.from(payload, 'base64');
  const iv = buf.subarray(0, IV_LENGTH);
  const tag = buf.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
  const enc = buf.subarray(IV_LENGTH + TAG_LENGTH);
  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8');
}

/** Generates a URL-safe random token (used for password reset / invitations). */
export function generateToken(bytes = 32): string {
  return randomBytes(bytes).toString('hex');
}

/** SHA-256 hex hash of a bearer token for safe DB storage / lookup. */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
