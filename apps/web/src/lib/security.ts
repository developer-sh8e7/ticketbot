import crypto from 'node:crypto';
import { NextRequest } from 'next/server';

const CONTROL_CHARS = /[\u0000-\u001F\u007F]/g;
const HTML_CHARS = /[<>]/g;
const PRIVATE_HOSTS = [/^localhost$/i, /^127\./, /^10\./, /^192\.168\./, /^172\.(1[6-9]|2\d|3[01])\./, /^0\./, /^169\.254\./, /^::1$/];

export function timingSafeEqualHex(a: string, b: string) {
  try {
    const aa = Buffer.from(a.replace(/^sha256=/, ''), 'hex');
    const bb = Buffer.from(b.replace(/^sha256=/, ''), 'hex');
    return aa.length === bb.length && crypto.timingSafeEqual(aa, bb);
  } catch {
    return false;
  }
}

export function hmacSha256Hex(payload: string | Buffer, secret: string) {
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
}

export function hasHtml(value: string) {
  return HTML_CHARS.test(value);
}

export function stripControlChars(value: string) {
  return value.replace(CONTROL_CHARS, '').trim();
}

export function rejectHtml(value: string) {
  return !hasHtml(value) && value === stripControlChars(value);
}

export function isSafeHttpsUrl(input: string) {
  try {
    const url = new URL(input);
    // Production: require https. Dev: allow http for localhost.
    if (url.protocol === 'http:' && !url.hostname.match(/^(localhost|127\.)/)) return false;
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return false;
    const host = url.hostname;
    return !PRIVATE_HOSTS.some((rx) => rx.test(host));
  } catch {
    return false;
  }
}

/**
 * Enforce HTTPS-only for specified URLs in production.
 * Throws if production and URL is not https.
 */
export function requireHttpsUrl(url: string, label: string): void {
  if (!url.startsWith('https://')) {
    throw new Error(`${label} must use https:// in production (got: ${url})`);
  }
}

/**
 * Reject non-HTTPS webhook URLs.
 */
export function isSecureWebhookUrl(input: string): boolean {
  return input.startsWith('https://');
}

export function clientIp(req: NextRequest) {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'unknown';
}

export function maskIdentifier(value: string | null | undefined) {
  if (!value) return null;
  if (value.length <= 8) return '***';
  return `${value.slice(0, 4)}…${value.slice(-4)}`;
}
