export const runtime = 'nodejs';

import { NextRequest } from 'next/server';
import { fail, internalError, ok } from '@/lib/api-response';
import { isAdminRequest, isAdminDiscordUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { logWebsiteEvent } from '@/lib/events';
import { decryptField, hashField } from '@/lib/encryption';

export async function GET(req: NextRequest) {
  try {
    if (!isAdminRequest(req)) {
      try {
        const discordAdmin = await isAdminDiscordUser();
        if (!discordAdmin) return fail('unauthorized', 'Admin access required', 401);
      } catch { return fail('unauthorized', 'Admin access required (env not configured)', 401); }
    }

    const url = new URL(req.url);
    const searchType = url.searchParams.get('search_type'); // 'email' | 'order_id' | null
    const searchValue = url.searchParams.get('q')?.trim() || null;

    let rows: Record<string, unknown>[] = [];

    if (searchValue && searchType === 'email') {
      const emailHash = hashField(searchValue.toLowerCase());
      const { data, error } = await supabaseAdmin()
        .from('sellapp_orders')
        .select('*')
        .eq('customer_email_hash', emailHash)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      rows = (data || []) as unknown as Record<string, unknown>[];
    } else if (searchValue && searchType === 'order_id') {
      const orderIdHash = hashField(searchValue);
      const { data, error } = await supabaseAdmin()
        .from('sellapp_orders')
        .select('*')
        .eq('order_id_hash', orderIdHash)
        .order('created_at', { ascending: false })
        .limit(10);
      if (error) throw error;
      rows = (data || []) as unknown as Record<string, unknown>[];
    } else {
      const { data, error } = await supabaseAdmin()
        .from('sellapp_orders')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      rows = (data || []) as unknown as Record<string, unknown>[];
    }

    // Decrypt sensitive fields for admin display
    const orders = rows.map((row: Record<string, unknown>) => {
      let decryptedEmail: string | null = null;
      let decryptedName: string | null = null;
      try {
        if (row.customer_email_enc) decryptedEmail = decryptField(row.customer_email_enc as string);
      } catch { /* keep null */ }
      try {
        if (row.customer_name_enc) decryptedName = decryptField(row.customer_name_enc as string);
      } catch { /* keep null */ }

      logWebsiteEvent({
        eventType: 'admin_view_order',
        message: 'Admin viewed order details',
        metadata: { order_id: row.order_id, admin_type: req.headers.get('x-admin-token') ? 'token' : 'discord' },
      }).catch(() => {});

      return {
        id: row.id,
        order_id: row.order_id,
        invoice_id: row.invoice_id,
        customer_email: decryptedEmail,
        customer_name: decryptedName,
        customer_email_hash: row.customer_email_hash,
        product_id: row.product_id,
        listing_id: row.listing_id,
        product_slug: row.product_slug,
        product_name: row.product_name,
        amount: row.amount,
        currency: row.currency,
        status: row.status,
        created_at: row.created_at,
        updated_at: row.updated_at,
        encryption_version: row.encryption_version,
      };
    });

    return ok({ orders });
  } catch (error) {
    console.error('[admin/orders]', error);
    return internalError();
  }
}
