import crypto from 'node:crypto';
import { logger } from './logger.js';

/**
 * Fernet-compatible token decryption (mirrors Python cryptography.fernet).
 *
 * Key derivation: SHA256(raw_key) → base64url → Fernet key (32 bytes).
 * Fernet key is split: signing key (16 bytes) + encryption key (16 bytes).
 *
 * Token format (base64-decoded):
 *   version(1) | timestamp(8) | IV(16) | ciphertext(N) | HMAC-SHA256(32)
 */
function deriveFernetKey(rawKey: string): Buffer {
  const digest = crypto.createHash('sha256').update(rawKey, 'utf-8').digest();
  return Buffer.from(digest.toString('base64url'), 'base64url');
}

export function decryptToken(encryptedToken: string, encryptionKey: string): string {
  const fk = deriveFernetKey(encryptionKey);
  const signingKey = fk.subarray(0, 16);
  const cryptoKey = fk.subarray(16, 32);

  const raw = Buffer.from(encryptedToken, 'base64url');

  if (raw.length < 57) {
    throw new Error(`Fernet token too short: ${raw.length} bytes`);
  }

  const version = raw.readUInt8(0);
  if (version !== 0x80) {
    throw new Error(`Unsupported Fernet version: ${version}`);
  }

  // const timestamp = Number(raw.readBigUInt64BE(1));
  const iv = raw.subarray(9, 25);
  const ciphertext = raw.subarray(25, raw.length - 32);
  const hmacActual = raw.subarray(raw.length - 32);

  // Verify HMAC: HMAC-SHA256(version + timestamp + IV + ciphertext)
  const hmacExpected = crypto.createHmac('sha256', signingKey)
    .update(raw.subarray(0, raw.length - 32))
    .digest();

  if (!crypto.timingSafeEqual(hmacActual, hmacExpected)) {
    throw new Error('Fernet HMAC verification failed — token may be corrupted or key mismatch');
  }

  // Decrypt AES-128-CBC with PKCS7 padding
  const decipher = crypto.createDecipheriv('aes-128-cbc', cryptoKey, iv);
  decipher.setAutoPadding(true);

  const plaintext = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);

  return plaintext.toString('utf-8');
}
