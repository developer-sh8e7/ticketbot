import crypto from 'node:crypto';
import { supabaseAdmin } from './supabase';
import { encryptField, hashField, decryptField } from './encryption';
import { getProductPrefix } from './site-content';

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function chunk() {
  let out = '';
  const bytes = crypto.randomBytes(4);
  for (const b of bytes) out += ALPHABET[b % ALPHABET.length];
  return out;
}

export function generateActivationCode(productType: string = 'ticket') {
  const prefix = getProductPrefix(productType);
  if (productType === 'humanguard') {
    return `OPUS-${prefix}-${chunk()}-OpusAi`;
  }
  return `OPUS-${prefix}-${chunk()}-${chunk()}`;
}

/**
 * Create a new activation code with encrypted storage.
 *
 * The plain code is returned so the webhook can show it to the customer,
 * but it is NEVER stored in plaintext — only code_enc + code_hash persist.
 */
export async function createUniqueActivationCode(input: {
  orderId: string;
  invoiceId?: string | null;
  customerEmail?: string | null;
  productId?: string | null;
  productName?: string | null;
  productType?: string;
  metadata?: Record<string, unknown>;
}) {
  const resolvedType = input.productType || 'ticket';
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const code = generateActivationCode(resolvedType);
    const codeEnc = encryptField(code);
    const codeHash = hashField(code);
    const customerEmailEnc = input.customerEmail ? encryptField(input.customerEmail) : null;
    const customerEmailHash = input.customerEmail ? hashField(input.customerEmail) : null;

    const { data, error } = await supabaseAdmin()
      .from('activation_codes')
      .insert({
        code_enc: codeEnc,
        code_hash: codeHash,
        order_id: input.orderId,
        invoice_id: input.invoiceId ?? null,
        customer_email_enc: customerEmailEnc,
        customer_email_hash: customerEmailHash,
        product_id: input.productId ?? null,
        product_type: resolvedType,
        product_name: input.productName ?? 'Discord ticket bot',
        plan_type: 'paid',
        status: 'unused',
        expires_at: new Date(Date.now() + 1000 * 60 * 60 * 24 * 35).toISOString(),
        metadata: input.metadata ?? {},
        encryption_version: 1,
      })
      .select('*')
      .single();
    if (!error) {
      // Attach the plain code for the response (never logged)
      return { ...data, code };
    }
    if (!String(error.message).toLowerCase().includes('duplicate')) throw error;
    // code_hash collision — retry
  }
  throw new Error('Unable to generate a unique activation code');
}

/**
 * Look up an activation code by its HMAC-SHA256 hash.
 * Used by the auth callback to find the code without exposing the plain value.
 */
export async function lookupActivationCodeByHash(codeHash: string) {
  const { data, error } = await supabaseAdmin()
    .from('activation_codes')
    .select('*')
    .eq('code_hash', codeHash)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/**
 * Decrypt an activation code from its stored encrypted form (admin use only).
 */
export async function decryptActivationCodeById(id: string): Promise<string | null> {
  const { data, error } = await supabaseAdmin()
    .from('activation_codes')
    .select('code_enc')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  if (!data?.code_enc) return null;
  try {
    return decryptField(data.code_enc);
  } catch {
    return null;
  }
}

/**
 * Decrypt customer email from activation code (admin use only).
 */
export async function decryptCustomerEmailById(id: string): Promise<string | null> {
  const { data, error } = await supabaseAdmin()
    .from('activation_codes')
    .select('customer_email_enc')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  if (!data?.customer_email_enc) return null;
  try {
    return decryptField(data.customer_email_enc);
  } catch {
    return null;
  }
}

/**
 * Update owner PII (encrypted) after Discord OAuth claim.
 */
export async function updateOwnerPii(id: string, input: { discordUserId: string; discordUsername?: string; discordAvatar?: string | null }) {
  const updates: Record<string, unknown> = {
    owner_discord_id: input.discordUserId,
    status: 'claimed',
    used_at: new Date().toISOString(),
  };
  if (input.discordUsername) {
    updates.owner_discord_username_enc = encryptField(input.discordUsername);
  }
  if (input.discordAvatar) {
    updates.owner_discord_avatar_enc = encryptField(input.discordAvatar);
  }
  const { error } = await supabaseAdmin().from('activation_codes').update(updates).eq('id', id);
  if (error) throw error;
}

/**
 * Search activation codes by customer email hash (admin lookup).
 */
export async function searchByEmail(email: string) {
  const emailHash = hashField(email);
  const { data, error } = await supabaseAdmin()
    .from('activation_codes')
    .select('*')
    .eq('customer_email_hash', emailHash)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

/**
 * Search activation codes by code hash (admin lookup from customer's code).
 */
export async function searchByCode(code: string) {
  const codeHash = hashField(code);
  return lookupActivationCodeByHash(codeHash);
}
