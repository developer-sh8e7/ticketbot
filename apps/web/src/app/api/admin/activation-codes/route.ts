export const runtime = 'nodejs';

import { NextRequest } from 'next/server';
import { fail, internalError, ok } from '@/lib/api-response';
import { isAdminRequest, isAdminDiscordUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { logWebsiteEvent } from '@/lib/events';
import { decryptField, hashField, maskValue } from '@/lib/encryption';

export async function GET(req: NextRequest) {
  try {
    // ── Admin auth ───────────────────────────────────────────────────────────
    if (!isAdminRequest(req)) {
      try { if (!(await isAdminDiscordUser())) return fail('unauthorized', 'Admin access required', 401); }
      catch { return fail('unauthorized', 'Admin access required (env not configured)', 401); }
    }

    const url = new URL(req.url);
    const searchType = url.searchParams.get('search_type'); // 'email' | 'code' | null
    const searchValue = url.searchParams.get('q')?.trim() || null;

    let rows: Record<string, unknown>[] = [];

    if (searchValue && searchType === 'email') {
      // Search by email hash
      const emailHash = hashField(searchValue.toLowerCase());
      const { data, error } = await supabaseAdmin()
        .from('activation_codes')
        .select('*')
        .eq('customer_email_hash', emailHash)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      rows = (data || []) as unknown as Record<string, unknown>[];
    } else if (searchValue && searchType === 'code') {
      // Search by code hash
      const codeHash = hashField(searchValue.toUpperCase());
      const { data, error } = await supabaseAdmin()
        .from('activation_codes')
        .select('*')
        .eq('code_hash', codeHash)
        .order('created_at', { ascending: false })
        .limit(10);
      if (error) throw error;
      rows = (data || []) as unknown as Record<string, unknown>[];
    } else {
      // List latest 200
      const { data, error } = await supabaseAdmin()
        .from('activation_codes')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      rows = (data || []) as unknown as Record<string, unknown>[];
    }

    // ── Decrypt sensitive fields for admin display ───────────────────────────
    const activationCodes = rows.map((row: Record<string, unknown>) => {
      let decryptedCode: string | null = null;
      let decryptedEmail: string | null = null;
      let decryptedUsername: string | null = null;
      let decryptedAvatar: string | null = null;

      try {
        if (row.code_enc) decryptedCode = decryptField(row.code_enc as string);
      } catch { /* keep null */ }
      try {
        if (row.customer_email_enc) decryptedEmail = decryptField(row.customer_email_enc as string);
      } catch { /* keep null */ }
      try {
        if (row.owner_discord_username_enc) decryptedUsername = decryptField(row.owner_discord_username_enc as string);
      } catch { /* keep null */ }
      try {
        if (row.owner_discord_avatar_enc) decryptedAvatar = decryptField(row.owner_discord_avatar_enc as string);
      } catch { /* keep null */ }

      // Audit log: admin viewed sensitive data
      const adminUser = req.headers.get('x-admin-token') ? 'token' : 'discord';
      logWebsiteEvent({
        eventType: 'admin_view_activation_code',
        message: 'Admin viewed activation code details',
        metadata: {
          code_id: row.id,
          admin_type: adminUser,
          // Never log the decrypted values
        },
      }).catch(() => {});

      return {
        id: row.id,
        code: decryptedCode,
        customer_email: decryptedEmail,
        customer_email_hash: row.customer_email_hash,
        code_hash_prefix: row.code_hash ? (row.code_hash as string).slice(0, 16) : null,
        order_id: row.order_id,
        invoice_id: row.invoice_id,
        owner_discord_username: decryptedUsername,
        owner_discord_avatar: decryptedAvatar,
        owner_discord_id: row.owner_discord_id,
        guild_id: row.guild_id,
        product_id: row.product_id,
        product_type: row.product_type,
        product_name: row.product_name,
        plan_type: row.plan_type,
        bot_instance_id: row.bot_instance_id,
        status: row.status,
        used_at: row.used_at,
        created_at: row.created_at,
        expires_at: row.expires_at,
        encryption_version: row.encryption_version,
      };
    });

    return ok({ activation_codes: activationCodes });
  } catch (error) {
    console.error('[admin/activation-codes]', error);
    return internalError();
  }
}
