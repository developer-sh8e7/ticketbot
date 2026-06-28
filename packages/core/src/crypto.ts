import crypto from 'node:crypto';

/**
 * Fernet-compatible token encryption/decryption (mirrors Python cryptography.fernet).
 *
 * هذا يضمن التوافق مع التوكنات التي قد تكون مشفّرة مسبقاً ببايثون،
 * ويتيح تشفير التوكنات الجديدة عند تعبئة بركة التوكنات (token pool).
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

  const iv = raw.subarray(9, 25);
  const ciphertext = raw.subarray(25, raw.length - 32);
  const hmacActual = raw.subarray(raw.length - 32);

  const hmacExpected = crypto.createHmac('sha256', signingKey)
    .update(raw.subarray(0, raw.length - 32))
    .digest();

  if (!crypto.timingSafeEqual(hmacActual, hmacExpected)) {
    throw new Error('Fernet HMAC verification failed — token may be corrupted or key mismatch');
  }

  const decipher = crypto.createDecipheriv('aes-128-cbc', cryptoKey, iv);
  decipher.setAutoPadding(true);

  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf-8');
}

/**
 * تشفير توكن بصيغة Fernet متوافقة — يُستخدم عند إضافة توكنات جديدة لبركة التوكنات.
 * لا تخزّن أي توكن بصيغة نصية أبداً؛ مرّره دائماً عبر هذه الدالة أولاً.
 */
export function encryptToken(plainToken: string, encryptionKey: string): string {
  const fk = deriveFernetKey(encryptionKey);
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
