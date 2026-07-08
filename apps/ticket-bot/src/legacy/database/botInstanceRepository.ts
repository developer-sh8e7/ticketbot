import type { SupabaseClient } from '@supabase/supabase-js';

export type ProductType = 'ticket' | 'system' | 'verify' | 'custom' | 'web';

/** Ticket settings saved from the website dashboard (bot_configs.config_data.ticketSettings) */
export interface TicketSettingsData {
  panel_channel_id?: string | null;
  log_channel_id?: string | null;
  transcript_channel_id?: string | null;
  ticket_category_id?: string | null;
  archive_category_id?: string | null;
  support_role_id?: string | null;
  panel_message?: string;
  embed_color?: string;
  banner_url?: string | null;
  button_text?: string;
  footer_text?: string;
  categories?: Array<{
    key: string;
    label: string;
    description: string;
    emoji?: string;
    enabled: boolean;
  }>;
  buttons?: Partial<Record<'close' | 'add' | 'remove' | 'claim' | 'pin', {
    label: string;
    style: 'Primary' | 'Secondary' | 'Success' | 'Danger';
    emoji?: string;
  }>>;
}

/** Partial config_data from bot_configs table */
export interface BotConfigData {
  commands?: {
    names?: Record<string, string>;
  };
  categories?: Array<{
    key: string;
    label: string;
    enabled: boolean;
  }>;
  ticketSettings?: TicketSettingsData;
}
export type InstanceStatus = 'active' | 'expired' | 'cancelled' | 'paused' | 'rejected';

export interface BotInstanceRecord {
  id: string;
  bot_user_id: string | null;
  bot_name: string;
  bot_token_encrypted: string;
  guild_id: string | null;
  guild_name: string | null;
  owner_id: string | null;
  product_type: ProductType;
  plan_type: 'trial' | 'paid';
  status: InstanceStatus;
  config_id: string | null;
  started_at: string | null;
  expires_at: string | null;
  support_ends_at: string | null;
  created_at: string;
  updated_at: string;
  last_started_at: string | null;
  last_stopped_at: string | null;
  expired_notified_at: string | null;
  notes: string | null;
}

export class BotInstanceRepository {
  public constructor(private readonly supabase: SupabaseClient) {}

  /**
   * Mark active ticket instances as expired once expires_at is in the past.
   * This prevents the manager from repeatedly trying to start stale services.
   */
  public async expireStaleActiveTicketInstances(now = new Date()): Promise<number> {
    const { data, error } = await this.supabase
      .from('bot_instances')
      .update({ status: 'expired', updated_at: now.toISOString() })
      .eq('status', 'active')
      .eq('product_type', 'ticket')
      .not('expires_at', 'is', null)
      .lte('expires_at', now.toISOString())
      .select('id');

    if (error) throw new Error(`Failed to expire stale bot instances: ${error.message}`);
    return data?.length ?? 0;
  }

  /**
   * Find all bot instances that should be running.
   * Active ticket-product bots that have a guild/token and are not expired.
   */
  public async findActiveTicketInstances(now = new Date()): Promise<BotInstanceRecord[]> {
    const { data, error } = await this.supabase
      .from('bot_instances')
      .select('*')
      .eq('status', 'active')
      .eq('product_type', 'ticket')
      .or(`expires_at.is.null,expires_at.gt.${now.toISOString()}`)
      .not('guild_id', 'is', null)
      .not('bot_token_encrypted', 'is', null)
      .order('created_at', { ascending: false });

    if (error) throw new Error(`Failed to query active bot instances: ${error.message}`);

    // Defensive de-dupe: if duplicate records exist for the same bot+guild,
    // only run the newest one to avoid multiple logins with the same token/app.
    const unique = new Map<string, BotInstanceRecord>();
    for (const record of (data ?? []) as BotInstanceRecord[]) {
      const key = `${record.bot_user_id ?? record.id}:${record.guild_id ?? 'noguild'}`;
      if (!unique.has(key)) unique.set(key, record);
    }
    return [...unique.values()];
  }

  /** Find a specific bot instance by ID */
  public async findById(id: string): Promise<BotInstanceRecord | null> {
    const { data, error } = await this.supabase
      .from('bot_instances')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) throw new Error(`Failed to query bot instance ${id}: ${error.message}`);
    return data as BotInstanceRecord | null;
  }

  /** Find instances by bot_user_id (Discord application ID) */
  public async findByBotUserId(botUserId: string): Promise<BotInstanceRecord[]> {
    const { data, error } = await this.supabase
      .from('bot_instances')
      .select('*')
      .eq('bot_user_id', botUserId);

    if (error) throw new Error(`Failed to query bot instances by user ID: ${error.message}`);
    return (data ?? []) as BotInstanceRecord[];
  }

  /** Update instance status */
  public async updateStatus(id: string, status: InstanceStatus): Promise<void> {
    const { error } = await this.supabase
      .from('bot_instances')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) throw new Error(`Failed to update bot instance ${id} status: ${error.message}`);
  }

  /** Mark instance as started */
  public async markStarted(id: string): Promise<void> {
    const now = new Date().toISOString();
    const { error } = await this.supabase
      .from('bot_instances')
      .update({ last_started_at: now, started_at: now, updated_at: now })
      .eq('id', id);

    if (error) throw new Error(`Failed to mark bot instance ${id} as started: ${error.message}`);
  }

  /** Mark instance as stopped */
  public async markStopped(id: string): Promise<void> {
    const now = new Date().toISOString();
    const { error } = await this.supabase
      .from('bot_instances')
      .update({ last_stopped_at: now, updated_at: now })
      .eq('id', id);

    if (error) throw new Error(`Failed to mark bot instance ${id} as stopped: ${error.message}`);
  }

  /** Fetch config_data from bot_configs for a bot instance */
  public async findConfigByInstanceId(instanceId: string): Promise<BotConfigData | null> {
    const { data, error } = await this.supabase
      .from('bot_configs')
      .select('config_data')
      .eq('bot_instance_id', instanceId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw new Error(`Failed to query bot_configs: ${error.message}`);
    return (data?.config_data as BotConfigData | undefined) ?? null;
  }

  /** Log a service event */
  public async logEvent(input: {
    botInstanceId: string;
    userId?: string | null;
    guildId?: string | null;
    eventType: string;
    eventMessage: string;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    const { error } = await this.supabase.from('service_events').insert({
      bot_instance_id: input.botInstanceId,
      user_id: input.userId ?? null,
      guild_id: input.guildId ?? null,
      event_type: input.eventType,
      event_message: input.eventMessage,
      metadata: input.metadata ?? {},
    });

    if (error) throw new Error(`Failed to log service event: ${error.message}`);
  }
}
