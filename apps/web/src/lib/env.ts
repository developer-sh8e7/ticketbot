import { z } from 'zod';
import { products } from './site-content';

const optionalUrl = z.string().url().optional().or(z.literal('').transform(() => undefined));

const fieldEncryptionKeyRefine = (v: string) => {
  // Accept 32-byte base64, 64-char hex, or raw utf8 ≥ 32 chars
  if (Buffer.from(v, 'base64').length === 32) return true;
  if (/^[0-9a-f]{64}$/i.test(v)) return true;
  return Buffer.byteLength(v, 'utf8') >= 32;
};

const envSchema = z.object({
  APP_URL: z.string().url().default('http://localhost:3000'),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  TOKEN_ENCRYPTION_KEY: z.string().optional(),
  FIELD_ENCRYPTION_KEY: z.string().min(1).refine(fieldEncryptionKeyRefine, {
    message: 'FIELD_ENCRYPTION_KEY must be 32 bytes (base64), 64 hex chars, or ≥32 utf8 chars',
  }),
  SESSION_SECRET: z.string().min(32),
  JWT_SECRET: z.string().min(32).optional(),
  DISCORD_CLIENT_ID: z.string().min(1),
  DISCORD_CLIENT_SECRET: z.string().min(1),
  DISCORD_REDIRECT_URI: z.string().url(),
  PAYPAL_ENV: z.enum(['sandbox', 'live']).default('sandbox'),
  PAYPAL_CLIENT_ID: z.string().optional(),
  PAYPAL_CLIENT_SECRET: z.string().optional(),
  MANAGER_SYNC_URL: optionalUrl,
  MANAGER_SYNC_SECRET: z.string().optional(),
  TRIAL_MANAGER_ID: z.string().optional(),
  ADMIN_DASHBOARD_TOKEN: z.string().optional(),
  ADMIN_DISCORD_IDS: z.string().optional(),
  DISCORD_WEBHOOK_LOGS: z.string().url().optional(),
  DISCORD_BUY_WEB: z.string().url().optional(),
  TICKET_PRICE_USD: z.string().optional(),
});

let cached: z.infer<typeof envSchema> | null = null;

export function env() {
  if (!cached) {
    const parsed = envSchema.safeParse(process.env);
    if (!parsed.success) {
      // Log variable names + messages (never values) so the real cause is visible in deploy logs.
      const issues = parsed.error.issues
        .map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`)
        .join('; ');
      console.error('[env] Invalid environment configuration ->', issues);
      throw new Error(`Invalid environment configuration: ${issues}`);
    }
    cached = parsed.data;
    // Production HTTPS enforcement
    if (cached.NODE_ENV === 'production' && !cached.APP_URL.startsWith('https://')) {
      const msg =
        `APP_URL must use https:// in production (got: ${cached.APP_URL}). ` +
        'Set APP_URL=https://opussolutions.up.railway.app in Railway Variables.';
      console.error('[env]', msg);
      throw new Error(msg);
    }
  }
  return cached;
}

export function isProduction() {
  // Independent of env() — safe for middleware/edge runtime
  return process.env.NODE_ENV === 'production';
}

/**
 * Safe public-facing config.
 * NEVER return secrets (FIELD_ENCRYPTION_KEY, SERVICE_ROLE_KEY, etc.) here.
 * NEVER return data that could help an attacker (order IDs, customer emails).
 */
function paypalUrlFromPriceLabel(priceLabel: string) {
  const price = priceLabel.match(/(\d+(?:[.,]\d+)?)/)?.[1]?.replace(',', '.');
  return price ? `https://paypal.me/AAlamri381/${price}` : '/pricing';
}

export function publicConfig() {
  const ticket = products().find((product) => product.key === 'ticket');
  const ticketPriceUsd = ticket?.price_monthly.toFixed(2) || '';

  return {
    ticketPriceUsd,
    paypalTicketProductUrl: paypalUrlFromPriceLabel(ticketPriceUsd),
  };
}
