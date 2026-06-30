/**
 * Shared rules for which purchases auto-provision a bot, plus a token-stock
 * pre-check so the site never charges for a product it can't deliver.
 */
import { supabaseAdmin } from './supabase';

/** Product types that consume a pooled bot token and auto-provision an instance. */
export const PROVISIONABLE_TYPES = new Set(['ticket', 'voice_rooms', 'general']);

const ARABIC_NAMES: Record<string, string> = {
  ticket: 'بوت التذاكر',
  voice_rooms: 'الغرف المؤقتة',
  general: 'بوت الإدارة',
  humanguard: 'HumanGuard AI',
  custom: 'بوت مخصص',
};

export function productArabicName(productType: string): string {
  return ARABIC_NAMES[productType] ?? productType;
}

/** True for products that need a pooled token (excludes manual/custom products). */
export function isProvisionable(productType: string): boolean {
  return PROVISIONABLE_TYPES.has(productType);
}

export type StockShortage = { productType: string; needed: number; available: number };

/**
 * Verify enough available tokens exist for every provisionable product in the
 * order. Returns the first shortage found, or null when everything is in stock.
 * This is a best-effort gate; the atomic claim at capture time is the real guard
 * against double-allocation.
 */
export async function checkTokenStock(productTypes: string[], ownerDiscordId?: string): Promise<StockShortage | null> {
  const needed = new Map<string, number>();
  for (const pt of productTypes) {
    if (isProvisionable(pt)) needed.set(pt, (needed.get(pt) ?? 0) + 1);
  }
  const supabase = supabaseAdmin();
  for (const [productType, count] of needed) {
    let available: number;
    // Count general stock plus any token reserved for this specific buyer.
    if (ownerDiscordId) {
      const res = await supabase.rpc('available_token_count_for', { p_product_type: productType, p_owner_id: ownerDiscordId });
      if (res.error) {
        // Reservation RPC not migrated yet → fall back to general count so checkout never breaks.
        const fb = await supabase.rpc('available_token_count', { p_product_type: productType });
        if (fb.error) throw fb.error;
        available = Number(fb.data) || 0;
      } else {
        available = Number(res.data) || 0;
      }
    } else {
      const { data, error } = await supabase.rpc('available_token_count', { p_product_type: productType });
      if (error) throw error;
      available = Number(data) || 0;
    }
    if (available < count) return { productType, needed: count, available };
  }
  return null;
}

type PendingPayload = {
  productType: string;
  guildId: string;
  guildName: string | null;
  ownerId: string;
  accountId: string | null;
  planId: string;
  durationDays: number;
  externalRef: string;
};

/**
 * Fulfill paid-but-deferred orders for a product type (called after the owner
 * tops up the token pool). Best-effort and idempotent: an order is skipped once
 * a matching `provisioned` event exists. Returns the number newly activated.
 */
export async function fulfillPendingProvisions(productType: string, limit = 10): Promise<number> {
  const supabase = supabaseAdmin();

  const { data: pendingEvents, error } = await supabase
    .from('payment_events')
    .select('id,external_event_id,payload,created_at')
    .eq('event_type', 'provision_pending')
    .order('created_at', { ascending: true })
    .limit(100);
  if (error || !pendingEvents) return 0;

  let fulfilled = 0;
  for (const ev of pendingEvents) {
    if (fulfilled >= limit) break;
    const payload = ev.payload as PendingPayload | null;
    if (!payload || payload.productType !== productType) continue;

    // Idempotency: skip if this order+product was already provisioned.
    const { count: doneCount } = await supabase
      .from('payment_events')
      .select('id', { count: 'exact', head: true })
      .eq('event_type', 'provisioned')
      .eq('external_event_id', ev.external_event_id);
    if ((doneCount ?? 0) > 0) continue;

    const { data: instance, error: provErr } = await supabase.rpc('provision_instance', {
      p_account_id: payload.accountId,
      p_owner_id: payload.ownerId,
      p_guild_id: payload.guildId,
      p_guild_name: payload.guildName,
      p_product_type: payload.productType,
      p_plan_name: payload.planId,
      p_duration_days: payload.durationDays,
      p_external_ref: payload.externalRef,
    });
    if (provErr) {
      // Out of tokens again — stop; remaining orders stay pending.
      if (/NO_TOKEN_AVAILABLE/.test(provErr.message)) break;
      continue;
    }
    await supabase.from('payment_events').insert({ provider: 'paypal', event_type: 'provisioned', external_event_id: ev.external_event_id, payload: { instance, productType, fulfilledFromPending: true } });
    fulfilled += 1;
  }
  return fulfilled;
}
