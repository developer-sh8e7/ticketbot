import type { SupabaseClient } from '@supabase/supabase-js';

export type ProductType = 'ticket' | 'system' | 'verify' | 'custom' | 'web';
export type ServiceStatus = 'active' | 'expired' | 'cancelled' | 'paused' | 'rejected';

export interface TrialRecord {
  id: string;
  user_id: string;
  guild_id: string;
  guild_name: string | null;
  owner_id: string | null;
  product_type: ProductType;
  bot_instance_id: string | null;
  status: ServiceStatus;
  accepted_by: string | null;
  accepted_at: string | null;
  starts_at: string;
  expires_at: string;
  support_ends_at: string;
  rejected_by: string | null;
  rejected_at: string | null;
  reject_reason: string | null;
  created_at: string;
  updated_at: string;
  expired_notified_at?: string | null;
}

export interface SubscriptionRecord {
  id: string;
  user_id: string;
  guild_id: string;
  guild_name: string | null;
  owner_id: string | null;
  product_type: ProductType;
  bot_instance_id: string | null;
  plan_name: string | null;
  status: ServiceStatus;
  starts_at: string;
  expires_at: string;
  support_ends_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  expired_notified_at: string | null;
}

export type ServiceRecord = (TrialRecord & { service_type: 'Trial' }) | (SubscriptionRecord & { service_type: 'Paid' });

export class OpusRepository {
  public constructor(private readonly supabase: SupabaseClient) {}

  public async findTrialByUserOrGuild(userId: string, guildId: string): Promise<TrialRecord | null> {
    const { data, error } = await this.supabase
      .from('trials')
      .select('*')
      .or(`user_id.eq.${userId},guild_id.eq.${guildId}`)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw new Error(`Failed to query trial: ${error.message}`);
    return data as TrialRecord | null;
  }

  public async findTrialByUser(userId: string): Promise<TrialRecord | null> {
    const { data, error } = await this.supabase
      .from('trials')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(`Failed to query trial by user: ${error.message}`);
    return data as TrialRecord | null;
  }

  public async findTrialByGuild(guildId: string): Promise<TrialRecord | null> {
    const { data, error } = await this.supabase
      .from('trials')
      .select('*')
      .eq('guild_id', guildId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(`Failed to query trial by guild: ${error.message}`);
    return data as TrialRecord | null;
  }

  public async createTrial(input: {
    userId: string;
    guildId: string;
    guildName?: string | null;
    ownerId?: string | null;
    productType: ProductType;
    botInstanceId?: string | null;
    acceptedBy: string;
    startsAt: Date;
    expiresAt: Date;
    supportEndsAt: Date;
  }): Promise<TrialRecord> {
    const { data, error } = await this.supabase
      .from('trials')
      .insert({
        user_id: input.userId,
        guild_id: input.guildId,
        guild_name: input.guildName ?? null,
        owner_id: input.ownerId ?? input.userId,
        product_type: input.productType,
        bot_instance_id: input.botInstanceId ?? null,
        status: 'active',
        accepted_by: input.acceptedBy,
        accepted_at: input.startsAt.toISOString(),
        starts_at: input.startsAt.toISOString(),
        expires_at: input.expiresAt.toISOString(),
        support_ends_at: input.supportEndsAt.toISOString(),
      })
      .select('*')
      .single();

    if (error) throw new Error(`Failed to create trial: ${error.message}`);
    return data as TrialRecord;
  }

  public async createSubscription(input: {
    userId: string;
    guildId: string;
    guildName?: string | null;
    ownerId?: string | null;
    productType: ProductType;
    botInstanceId?: string | null;
    planName?: string | null;
    createdBy: string;
    startsAt: Date;
    expiresAt: Date;
    supportEndsAt?: Date | null;
  }): Promise<SubscriptionRecord> {
    const { data, error } = await this.supabase
      .from('subscriptions')
      .insert({
        user_id: input.userId,
        guild_id: input.guildId,
        guild_name: input.guildName ?? null,
        owner_id: input.ownerId ?? input.userId,
        product_type: input.productType,
        bot_instance_id: input.botInstanceId ?? null,
        plan_name: input.planName ?? 'monthly',
        status: 'active',
        starts_at: input.startsAt.toISOString(),
        expires_at: input.expiresAt.toISOString(),
        support_ends_at: input.supportEndsAt?.toISOString() ?? null,
        created_by: input.createdBy,
      })
      .select('*')
      .single();

    if (error) throw new Error(`Failed to create subscription: ${error.message}`);
    return data as SubscriptionRecord;
  }

  public async findSubscriptionByUser(userId: string): Promise<SubscriptionRecord | null> {
    const { data, error } = await this.supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(`Failed to query subscription by user: ${error.message}`);
    return data as SubscriptionRecord | null;
  }

  public async findSubscriptionByGuild(guildId: string): Promise<SubscriptionRecord | null> {
    const { data, error } = await this.supabase
      .from('subscriptions')
      .select('*')
      .eq('guild_id', guildId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(`Failed to query subscription by guild: ${error.message}`);
    return data as SubscriptionRecord | null;
  }

  public async findExpiredTrials(now = new Date()): Promise<TrialRecord[]> {
    const { data, error } = await this.supabase
      .from('trials')
      .select('*')
      .eq('status', 'active')
      .lte('expires_at', now.toISOString())
      .is('expired_notified_at', null);
    if (error) throw new Error(`Failed to query expired trials: ${error.message}`);
    return (data ?? []) as TrialRecord[];
  }

  public async findExpiredSubscriptions(now = new Date()): Promise<SubscriptionRecord[]> {
    const { data, error } = await this.supabase
      .from('subscriptions')
      .select('*')
      .eq('status', 'active')
      .lte('expires_at', now.toISOString())
      .is('expired_notified_at', null);
    if (error) throw new Error(`Failed to query expired subscriptions: ${error.message}`);
    return (data ?? []) as SubscriptionRecord[];
  }

  public async markTrialExpired(id: string, notifiedAt = new Date()): Promise<void> {
    const { error } = await this.supabase
      .from('trials')
      .update({ status: 'expired', expired_notified_at: notifiedAt.toISOString() })
      .eq('id', id);
    if (error) throw new Error(`Failed to mark trial expired: ${error.message}`);
  }

  public async markSubscriptionExpired(id: string, notifiedAt = new Date()): Promise<void> {
    const { error } = await this.supabase
      .from('subscriptions')
      .update({ status: 'expired', expired_notified_at: notifiedAt.toISOString() })
      .eq('id', id);
    if (error) throw new Error(`Failed to mark subscription expired: ${error.message}`);
  }

  public async logEvent(input: {
    botInstanceId?: string | null;
    userId?: string | null;
    guildId?: string | null;
    eventType: string;
    eventMessage: string;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    const { error } = await this.supabase.from('service_events').insert({
      bot_instance_id: input.botInstanceId ?? null,
      user_id: input.userId ?? null,
      guild_id: input.guildId ?? null,
      event_type: input.eventType,
      event_message: input.eventMessage,
      metadata: input.metadata ?? {},
    });
    if (error) throw new Error(`Failed to log service event: ${error.message}`);
  }
}
