import { supabaseAdmin } from './supabase';
import { encryptField } from './encryption';

/**
 * Sensitive field keys that should NEVER appear in plaintext logs or metadata.
 */
const SENSITIVE_KEYS = new Set([
  'activation_code', 'code', 'code_enc', 'code_hash',
  'customer_email', 'customer_email_enc', 'customer_email_hash',
  'customer_name', 'customer_name_enc',
  'owner_discord_username_enc', 'owner_discord_avatar_enc',
  'email', 'password', 'token', 'secret', 'key', 'authorization',
  'access_token', 'refresh_token', 'bot_token', 'api_key',
  'discord_token', 'session_id',
  'raw_metadata', 'raw_metadata_enc',
  'metadata_enc', 'message_enc',
]);

/**
 * Strip sensitive fields from a metadata object before logging.
 * Returns a new object with only safe fields.
 */
function sanitizeMetadata(meta: Record<string, unknown>): Record<string, unknown> {
  const safe: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(meta)) {
    const lower = key.toLowerCase();
    if (SENSITIVE_KEYS.has(lower) || lower.endsWith('_enc') || lower.endsWith('_hash')) {
      // Skip sensitive fields entirely — never log them even masked
      continue;
    }
    // Recursively sanitize nested objects
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      safe[key] = sanitizeMetadata(value as Record<string, unknown>);
    } else {
      safe[key] = value;
    }
  }
  return safe;
}

export async function logWebsiteEvent(input: {
  eventType: string;
  message: string;
  userId?: string | null;
  guildId?: string | null;
  botInstanceId?: string | null;
  orderId?: string | null;
  metadata?: Record<string, unknown>;
}) {
  const safeMetadata = sanitizeMetadata(input.metadata ?? {});
  const messageEnc = encryptField(input.message);
  const metadataEnc = encryptField(JSON.stringify(safeMetadata));

  const { error } = await supabaseAdmin().from('website_events').insert({
    event_type: input.eventType,
    message: sanitizeMessage(input.message),
    message_enc: messageEnc,
    user_id: input.userId ?? null,
    guild_id: input.guildId ?? null,
    bot_instance_id: input.botInstanceId ?? null,
    order_id: input.orderId ?? null,
    metadata: safeMetadata,
    metadata_enc: metadataEnc,
    encryption_version: 1,
  });
  if (error) console.warn('[website_events] insert failed', error.message);
}

/**
 * Sanitize log message text — strip potential PII patterns.
 */
function sanitizeMessage(msg: string): string {
  // Strip anything that looks like an activation code (any product prefix)
  return msg.replace(/OPUS-[A-Z]+-[A-Z0-9]{4}-[A-Z0-9]{4}/g, 'OPUS-XXXX-XXXX-XXXX');
}
