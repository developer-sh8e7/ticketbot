/**
 * Add one bot token to the pool (encrypted, Fernet — same format the
 * orchestrator decrypts with). The dashboard owner panel does the same thing
 * with a nicer UI; this script is for CLI / bulk seeding.
 *
 * Usage:
 *   TOKEN_ENCRYPTION_KEY=... SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
 *   node db/seed/add_token.mjs <product_type> <application_id> <bot_token> [label] [reserved_for_discord_id]
 *
 *   product_type: ticket | voice_rooms | general
 *   reserved_for_discord_id (اختياري): يحجز هذا التوكن لزبون معيّن — لا يُسحب
 *     إلا عند شرائه هو، ولا يدخل البركة العامة.
 *
 * CRITICAL: TOKEN_ENCRYPTION_KEY here MUST equal the orchestrator's
 * TOKEN_ENCRYPTION_KEY, otherwise the bot can't be decrypted/started.
 */
import crypto from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const [, , productType, applicationId, botToken, label, reservedForDiscordId] = process.argv;
const { TOKEN_ENCRYPTION_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;

if (!productType || !applicationId || !botToken) {
  console.error('Usage: node db/seed/add_token.mjs <product_type> <application_id> <bot_token> [label]');
  process.exit(1);
}
if (!['ticket', 'voice_rooms', 'general'].includes(productType)) {
  console.error('product_type must be one of: ticket, voice_rooms, general');
  process.exit(1);
}
if (!TOKEN_ENCRYPTION_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing env: TOKEN_ENCRYPTION_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

// Fernet encryption — identical to packages/core/src/crypto.ts encryptToken.
function deriveFernetKey(rawKey) {
  const digest = crypto.createHash('sha256').update(rawKey, 'utf-8').digest();
  return Buffer.from(digest.toString('base64url'), 'base64url');
}
function encryptToken(plainToken, encryptionKey) {
  const fk = deriveFernetKey(encryptionKey);
  const signingKey = fk.subarray(0, 16);
  const cryptoKey = fk.subarray(16, 32);
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-128-cbc', cryptoKey, iv);
  const ciphertext = Buffer.concat([cipher.update(plainToken, 'utf-8'), cipher.final()]);
  const version = Buffer.from([0x80]);
  const timestamp = Buffer.alloc(8);
  timestamp.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 1000)));
  const body = Buffer.concat([version, timestamp, iv, ciphertext]);
  const hmac = crypto.createHmac('sha256', signingKey).update(body).digest();
  return Buffer.concat([body, hmac]).toString('base64url');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { error } = await supabase.from('token_pool').insert({
  product_type: productType,
  bot_application_id: applicationId,
  bot_token_encrypted: encryptToken(botToken, TOKEN_ENCRYPTION_KEY),
  status: 'available',
  label: label ?? null,
  reserved_for_discord_id: reservedForDiscordId ?? null,
});

if (error) {
  console.error('Insert failed:', error.message);
  process.exit(1);
}
const reservedNote = reservedForDiscordId ? ` (محجوز للزبون ${reservedForDiscordId})` : '';
console.log(`✅ Added ${productType} token (app ${applicationId}) to the pool as 'available'${reservedNote}.`);
