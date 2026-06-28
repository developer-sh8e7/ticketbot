import crypto from 'node:crypto';
import { env } from './env';
import { logWebsiteEvent } from './events';
import { hashPrefix } from './encryption';

/**
 * Notify the Bot Manager with HMAC-signed request.
 *
 * Security:
 *  - HTTPS enforced (caller must configure MANAGER_SYNC_URL as https://)
 *  - X-Manager-Sync-Secret header for identity
 *  - X-Opus-Timestamp + X-Opus-Signature HMAC for request integrity
 *  - Timestamp is checked server-side by the Bot Manager (replay protection)
 */

function computeSignature(rawBody: string, timestamp: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(`${timestamp}:${rawBody}`).digest('hex');
}

export async function notifyManagerSync(reason: string, metadata: Record<string, unknown> = {}) {
  const e = env();
  if (!e.MANAGER_SYNC_URL) {
    return { called: false, ok: false, warning: 'MANAGER_SYNC_URL is not configured' };
  }

  // Fail-fast if URL is not HTTPS (production check)
  if (e.NODE_ENV === 'production' && !e.MANAGER_SYNC_URL.startsWith('https://')) {
    const msg = `MANAGER_SYNC_URL must use HTTPS in production (got: ${e.MANAGER_SYNC_URL})`;
    console.error('[manager-sync]', msg);
    await logWebsiteEvent({ eventType: 'manager_sync_config_error', message: msg, metadata });
    return { called: false, ok: false, warning: msg };
  }

  try {
    const rawBody = JSON.stringify({ reason, source: 'opus-ticket-website', metadata });
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const secret = e.MANAGER_SYNC_SECRET || '';

    const signature = secret ? computeSignature(rawBody, timestamp, secret) : '';

    const headers: Record<string, string> = {
      'content-type': 'application/json',
      'x-opus-timestamp': timestamp,
    };

    if (e.MANAGER_SYNC_SECRET) {
      headers['x-manager-sync-secret'] = e.MANAGER_SYNC_SECRET;
      headers['x-opus-signature'] = signature;
    }

    const res = await fetch(e.MANAGER_SYNC_URL, {
      method: 'POST',
      headers,
      body: rawBody,
      cache: 'no-store',
    });

    // Safe log: never log secrets or PII
    console.info('[manager-sync]', {
      reason,
      timestamp,
      signature_prefix: signature ? signature.slice(0, 16) : 'none',
      status: res.status,
    });

    await logWebsiteEvent({
      eventType: 'manager_sync_called',
      message: `Manager sync: ${reason}`,
      metadata: { ok: res.ok, status: res.status, reason },
    });

    return { called: true, ok: res.ok, status: res.status };
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : 'unknown';
    console.error('[manager-sync] failed', errMsg);
    await logWebsiteEvent({
      eventType: 'manager_sync_failed',
      message: 'Manager sync failed',
      metadata: { reason, error: errMsg },
    });
    return { called: true, ok: false, warning: 'Manager sync failed; fallback sync will pick it up' };
  }
}

/**
 * Verify an incoming sync request's signature (for use by Bot Manager).
 * Returns { valid: boolean; reason?: string }
 */
export function verifySyncSignature(input: {
  rawBody: string;
  timestamp: string;
  signature: string;
  secret: string;
  maxAgeMs?: number;
}): { valid: boolean; reason?: string } {
  const { rawBody, timestamp, signature, secret, maxAgeMs = 300_000 } = input;

  // Reject missing signature
  if (!signature) return { valid: false, reason: 'Missing X-Opus-Signature' };
  if (!timestamp) return { valid: false, reason: 'Missing X-Opus-Timestamp' };

  // Replay protection: reject timestamps older than maxAgeMs
  const now = Date.now();
  const ts = parseInt(timestamp, 10) * 1000;
  if (Number.isNaN(ts) || now - ts > maxAgeMs) {
    return { valid: false, reason: 'Timestamp too old or invalid (replay?)' };
  }
  if (ts > now + 30_000) {
    return { valid: false, reason: 'Timestamp in the future (clock skew?)' };
  }

  // Compute expected signature and compare
  const expected = computeSignature(rawBody, timestamp, secret);
  try {
    const valid = crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(signature, 'hex'));
    if (!valid) return { valid: false, reason: 'Signature mismatch' };
  } catch {
    return { valid: false, reason: 'Invalid signature format' };
  }

  return { valid: true };
}
