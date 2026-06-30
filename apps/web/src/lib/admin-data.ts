/**
 * Owner-only data access for the admin section of the shared dashboard.
 * Every function here uses the Supabase service role and MUST only be called
 * after a server-side owner check (see lib/owner.ts).
 */
import { supabaseAdmin } from './supabase';

export type AdminStats = {
  totalAccounts: number;
  activeBots: number;
  expiredBots: number;
  trialBots: number;
  activeSubscriptions: number;
  availableTokens: number;
  capturedPayments: number;
  revenueUsd: number;
};

export type AdminSubscriber = {
  id: string;
  bot_name: string | null;
  bot_avatar_url: string | null;
  bot_banner_url: string | null;
  product_type: string | null;
  plan_type: string | null;
  status: string | null;
  owner_id: string | null;
  guild_id: string | null;
  guild_name: string | null;
  expires_at: string | null;
  last_started_at: string | null;
  created_at: string | null;
};

export type TokenPoolRow = { product_type: string; status: string; count: number };

export async function getAdminStats(): Promise<AdminStats> {
  const supabase = supabaseAdmin();

  const [
    accounts,
    activeBots,
    expiredBots,
    trialBots,
    activeSubs,
    availableTokens,
    payments,
  ] = await Promise.all([
    supabase.from('accounts').select('id', { count: 'exact', head: true }),
    supabase.from('bot_instances').select('id', { count: 'exact', head: true }).eq('status', 'active'),
    supabase.from('bot_instances').select('id', { count: 'exact', head: true }).eq('status', 'expired'),
    supabase.from('bot_instances').select('id', { count: 'exact', head: true }).eq('plan_type', 'trial'),
    supabase.from('subscriptions').select('id', { count: 'exact', head: true }).eq('status', 'active'),
    supabase.from('token_pool').select('id', { count: 'exact', head: true }).eq('status', 'available'),
    supabase.from('payments').select('amount_cents,currency,status').eq('status', 'captured').limit(1000),
  ]);

  const revenueCents = (payments.data || []).reduce((sum, p) => sum + (Number(p.amount_cents) || 0), 0);

  return {
    totalAccounts: accounts.count ?? 0,
    activeBots: activeBots.count ?? 0,
    expiredBots: expiredBots.count ?? 0,
    trialBots: trialBots.count ?? 0,
    activeSubscriptions: activeSubs.count ?? 0,
    availableTokens: availableTokens.count ?? 0,
    capturedPayments: (payments.data || []).length,
    revenueUsd: Math.round(revenueCents) / 100,
  };
}

export async function getSubscribers(limit = 100): Promise<AdminSubscriber[]> {
  const { data, error } = await supabaseAdmin()
    .from('bot_instances')
    .select('id,bot_name,bot_avatar_url,bot_banner_url,product_type,plan_type,status,owner_id,guild_id,guild_name,expires_at,last_started_at,created_at')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data || []) as AdminSubscriber[];
}

export async function getTokenPool(): Promise<TokenPoolRow[]> {
  const { data, error } = await supabaseAdmin().from('token_pool').select('product_type,status').limit(1000);
  if (error) throw error;
  const map = new Map<string, number>();
  for (const row of data || []) {
    const key = `${row.product_type}|${row.status}`;
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  return [...map.entries()].map(([key, count]) => {
    const [product_type, status] = key.split('|');
    return { product_type, status, count };
  });
}

/** A single bot instance by id — used by owner actions to scope updates safely. */
export async function getBotInstanceById(id: string) {
  const { data, error } = await supabaseAdmin()
    .from('bot_instances')
    .select('id,product_type,status,owner_id,guild_id,expires_at')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data;
}
