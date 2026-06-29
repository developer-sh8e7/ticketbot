/**
 * Field-level encryption utility.
 *
 * Uses AES-256-GCM (authenticated encryption) for all sensitive fields.
 * Searchable hashes use HMAC-SHA256 so lookups never touch plaintext.
 *
 * Key: FIELD_ENCRYPTION_KEY — 64 hex chars (32 bytes) or raw 32-byte base64.
 */

import crypto from 'node:crypto';
import { env } from './env';

const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 16;
const TAG_BYTES = 16;
const KEY_BYTES = 32;

// ─── Key derivation ───────────────────────────────────────────────────────────

let _key: Buffer | null = null;

function encryptionKey(): Buffer {
  if (_key) return _key;
  const raw = env().FIELD_ENCRYPTION_KEY;
  // Accept raw 32-byte base64 or 64-char hex, or raw utf8 padded to 32 bytes
  if (Buffer.from(raw, 'base64').length === KEY_BYTES) {
    _key = Buffer.from(raw, 'base64');
  } else if (/^[0-9a-f]{64}$/i.test(raw)) {
    _key = Buffer.from(raw, 'hex');
  } else {
    // Derive 32 bytes via SHA-256 (last resort — users should supply proper key)
    _key = crypto.createHash('sha256').update(raw, 'utf8').digest();
  }
  return _key;
}

// ─── Individual-field helpers (compact base64 format) ─────────────────────────

/**
 * Encrypt a plaintext string.
 * Returns `${ivBase64}:${ciphertextBase64}:${authTagBase64}`
 */
export function encryptField(plaintext: string): string {
  const key = encryptionKey();
  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(plaintext, 'utf8', 'base64');
  encrypted += cipher.final('base64');
  const authTag = cipher.getAuthTag();
  return `${iv.toString('base64')}:${encrypted}:${authTag.toString('base64')}`;
}

/**
 * Decrypt a field encrypted with encryptField().
 * Accepts `${ivBase64}:${ciphertextBase64}:${authTagBase64}`
 */
export function decryptField(combined: string): string {
  const parts = combined.split(':');
  if (parts.length < 3) throw new Error('Invalid encrypted field format');
  const key = encryptionKey();
  const iv = Buffer.from(parts[0], 'base64');
  const authTag = Buffer.from(parts[2], 'base64');
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  let decrypted = decipher.update(parts[1], 'base64', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

/**
 * Create a deterministic, searchable HMAC-SHA256 hash of a value.
 * Used for lookup columns (email_hash, code_hash, etc.).
 */
export function hashField(value: string): string {
  return crypto.createHmac('sha256', encryptionKey()).update(value, 'utf8').digest('hex');
}

/**
 * Verify a plaintext value against a stored hash (timing-safe).
 */
export function verifyFieldHash(value: string, hash: string): boolean {
  const computed = hashField(value);
  try {
    return crypto.timingSafeEqual(Buffer.from(computed, 'hex'), Buffer.from(hash, 'hex'));
  } catch {
    return false;
  }
}

// ─── Full-object helpers (structured encrypt + hash) ─────────────────────────

export type EncryptedPayload = {
  encrypted: string;   // encryptField(json)
  email_hash: string;  // for lookup
};

/**
 * Encrypt a JSON-serializable object and produce both encrypted + hash fields.
 */
export function encryptObject(payload: Record<string, unknown>): EncryptedPayload {
  return {
    encrypted: encryptField(JSON.stringify(payload)),
    email_hash: payload.email ? hashField(String(payload.email)) : '',
  };
}

/**
 * Decrypt and parse an object encrypted with encryptObject().
 */
export function decryptObject(encrypted: string): Record<string, unknown> {
  return JSON.parse(decryptField(encrypted));
}

// ─── Log sanitization ─────────────────────────────────────────────────────────

/**
 * Return only the first 4 + last 4 characters of a value, or masked fallback.
 */
export function maskValue(value: string | null | undefined): string | null {
  if (!value) return null;
  if (value.length <= 8) return '***';
  return `${value.slice(0, 4)}…${value.slice(-4)}`;
}

/**
 * Return the first 16 chars of a hash (enough for log correlation, not enough to reverse).
 */
export function hashPrefix(value: string): string {
  return hashField(value).slice(0, 16);
}

// ─── Token encryption (for bot tokens etc.) ──────────────────────────────────

export function encryptToken(plaintext: string): string {
  return encryptField(plaintext);
}

export function decryptToken(encrypted: string): string {
  return decryptField(encrypted);
}

// ─── Bot-pool token encryption (Fernet, must match @opus/core) ────────────────
//
// Bot tokens in `token_pool` are encrypted with Fernet keyed by
// TOKEN_ENCRYPTION_KEY so the orchestrator (which uses @opus/core decryptToken)
// can decrypt them. This mirrors packages/core/src/crypto.ts exactly. The web
// app doesn't depend on @opus/core, so the algorithm is replicated here for the
// owner "add token" action only.

function deriveFernetKey(rawKey: string): Buffer {
  const digest = crypto.createHash('sha256').update(rawKey, 'utf-8').digest();
  return Buffer.from(digest.toString('base64url'), 'base64url');
}

/** Encrypt a Discord bot token into the Fernet format the orchestrator expects. */
export function encryptBotToken(plainToken: string): string {
  const rawKey = env().TOKEN_ENCRYPTION_KEY;
  if (!rawKey) throw new Error('TOKEN_ENCRYPTION_KEY is not configured');
  const fk = deriveFernetKey(rawKey);
  const signingKey = fk.subarray(0, 16);
  const cryptoKey = fk.subarray(16, 32);

  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-128-cbc', cryptoKey, iv);
  cipher.setAutoPadding(true);
  const ciphertext = Buffer.concat([cipher.update(plainToken, 'utf-8'), cipher.final()]);

  const version = Buffer.from([0x80]);
  const timestamp = Buffer.alloc(8);
  timestamp.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 1000)));

  const body = Buffer.concat([version, timestamp, iv, ciphertext]);
  const hmac = crypto.createHmac('sha256', signingKey).update(body).digest();
  return Buffer.concat([body, hmac]).toString('base64url');
}
