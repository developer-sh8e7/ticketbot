import type { SupabaseClient } from '@supabase/supabase-js';

export interface InfrastructureRecord {
  guild_id: string;
  ticket_category_id: string | null;
  archive_category_id: string | null;
  log_channel_id: string | null;
  transcript_channel_id: string | null;
  panel_channel_id: string | null;
  panel_message_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface UpsertInfrastructureInput {
  guild_id: string;
  ticket_category_id?: string | null;
  archive_category_id?: string | null;
  log_channel_id?: string | null;
  transcript_channel_id?: string | null;
  panel_channel_id?: string | null;
  panel_message_id?: string | null;
}

export class InfrastructureRepository {
  public constructor(private readonly supabase: SupabaseClient) {}

  public async findByGuildId(guildId: string): Promise<InfrastructureRecord | null> {
    const { data, error } = await this.supabase
      .from('bot_infrastructure')
      .select('*')
      .eq('guild_id', guildId)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to query infrastructure: ${error.message}`);
    }

    return data as InfrastructureRecord | null;
  }

  public async upsert(input: UpsertInfrastructureInput): Promise<InfrastructureRecord> {
    const { data, error } = await this.supabase
      .from('bot_infrastructure')
      .upsert(input, { onConflict: 'guild_id' })
      .select('*')
      .single();

    if (error) {
      throw new Error(`Failed to upsert infrastructure: ${error.message}`);
    }

    return data as InfrastructureRecord;
  }
}
