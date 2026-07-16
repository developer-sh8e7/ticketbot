/**
 * Owner-only data access for the admin section of the shared dashboard.
 * Every function here uses the Supabase service role and MUST only be called
 * after a server-side owner check (see lib/owner.ts).
 */
import { supabaseAdmin } from './supabase';
import { decryptBotToken } from './encryption';
import { getBotProfile, getBotGuilds } from './discord';

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
  started_at: string | null;
  expires_at: string | null;
  last_started_at: string | null;
  created_at: string | null;
};

export type TokenPoolRow = { product_type: string; status: string; count: number };

/** A stored bot token in the pool — shown in the owner Bots dashboard even before anyone buys it. */
export type PoolBot = {
  id: string;
  productType: string | null;
  label: string | null;
  applicationId: string | null;
  status: string | null;
  reservedFor: string | null;
  instanceId: string | null;
  instanceGuildId: string | null;
  instanceGuildName: string | null;
  instanceStatus: string | null;
  instanceStartedAt: string | null;
  instanceExpiresAt: string | null;
  // Live bot profile + servers (fetched from Discord using the bot token).
  name: string | null;
  avatarUrl: string | null;
  bannerUrl: string | null;
  guilds: { id: string; name: string; iconUrl: string | null }[];
};

/**
 * Every token stored in the pool, with the running instance it powers (if any).
 * Lets the owner see and act on bots they've stored even before a customer buys.
 */
export async function getPoolBots(): Promise<PoolBot[]> {
  const supabase = supabaseAdmin();
  const { data: tokens, error } = await supabase
    .from('token_pool')
    .select('id,product_type,label,bot_application_id,status,reserved_for_discord_id,claimed_by_instance_id,bot_token_encrypted')
    .order('created_at', { ascending: true })
    .limit(60);
  if (error) throw error;

  const instanceIds = (tokens ?? []).map((t) => t.claimed_by_instance_id).filter(Boolean) as string[];
  const instanceById = new Map<string, { guild_id: string | null; guild_name: string | null; status: string | null; started_at: string | null; expires_at: string | null; created_at: string | null }>();
  if (instanceIds.length) {
    const { data: insts } = await supabase.from('bot_instances').select('id,guild_id,guild_name,status,started_at,expires_at,created_at').in('id', instanceIds);
    for (const i of insts ?? []) instanceById.set(i.id as string, { guild_id: i.guild_id, guild_name: i.guild_name, status: i.status, started_at: i.started_at, expires_at: i.expires_at, created_at: i.created_at });
  }

  // Fetch each bot's live profile + servers from Discord (owner-only page, few tokens).
  return Promise.all(
    (tokens ?? []).map(async (t): Promise<PoolBot> => {
      const inst = t.claimed_by_instance_id ? instanceById.get(t.claimed_by_instance_id as string) : null;
      let name: string | null = t.label;
      let avatarUrl: string | null = null;
      let bannerUrl: string | null = null;
      let guilds: { id: string; name: string; iconUrl: string | null }[] = [];
      try {
        const token = decryptBotToken(t.bot_token_encrypted as string);
        const [profile, botGuilds] = await Promise.all([getBotProfile(token), getBotGuilds(token)]);
        if (profile) {
          name = profile.username;
          avatarUrl = profile.avatarUrl;
          bannerUrl = profile.bannerUrl;
        }
        guilds = botGuilds;
      } catch {
        /* token undecryptable or Discord unavailable — fall back to label/initials */
      }
      return {
        id: t.id as string,
        productType: t.product_type,
        label: t.label,
        applicationId: t.bot_application_id,
        status: t.status,
        reservedFor: t.reserved_for_discord_id,
        instanceId: (t.claimed_by_instance_id as string) ?? null,
        instanceGuildId: inst?.guild_id ?? null,
        instanceGuildName: inst?.guild_name ?? null,
        instanceStatus: inst?.status ?? null,
        instanceStartedAt: inst?.started_at ?? inst?.created_at ?? null,
        instanceExpiresAt: inst?.expires_at ?? null,
        name,
        avatarUrl,
        bannerUrl,
        guilds,
      };
    }),
  );
}

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
    .select('id,bot_name,bot_avatar_url,bot_banner_url,product_type,plan_type,status,owner_id,guild_id,guild_name,started_at,expires_at,last_started_at,created_at')
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
