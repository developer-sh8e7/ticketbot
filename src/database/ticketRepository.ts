import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  CloseTicketInput,
  CreateTicketRecordInput,
  TicketRecord,
} from './types.js';

function mapTicket(row: unknown): TicketRecord {
  return row as TicketRecord;
}

function isDuplicateOpenTicketError(error: { code?: string; message?: string } | null): boolean {
  if (!error) {
    return false;
  }

  return error.code === '23505' || error.message?.toLowerCase().includes('duplicate key') === true;
}

export class DuplicateOpenTicketError extends Error {
  public constructor(message = 'User already has an open ticket.') {
    super(message);
    this.name = 'DuplicateOpenTicketError';
  }
}

export class TicketRepository {
  public constructor(private readonly supabase: SupabaseClient) {}

  public async nextTicketNumber(): Promise<number> {
    const { data, error } = await this.supabase.rpc('next_ticket_number');

    if (error) {
      throw new Error(`Failed to get next ticket number: ${error.message}`);
    }

    return Number(data);
  }

  public async createTicket(input: CreateTicketRecordInput): Promise<TicketRecord> {
    const { data, error } = await this.supabase
      .from('tickets')
      .insert({
        ticket_number: input.ticket_number,
        guild_id: input.guild_id,
        channel_id: input.channel_id,
        channel_name: input.channel_name,
        creator_id: input.creator_id,
        creator_tag: input.creator_tag,
        category_key: input.category_key,
        category_label: input.category_label,
        status: 'open',
        participant_ids: input.participant_ids,
        answers: input.answers,
        metadata: input.metadata,
      })
      .select('*')
      .single();

    if (error) {
      if (isDuplicateOpenTicketError(error)) {
        throw new DuplicateOpenTicketError();
      }

      throw new Error(`Failed to create ticket: ${error.message}`);
    }

    return mapTicket(data);
  }

  public async deleteTicketById(ticketId: string): Promise<void> {
    const { error } = await this.supabase.from('tickets').delete().eq('id', ticketId);

    if (error) {
      throw new Error(`Failed to delete ticket ${ticketId}: ${error.message}`);
    }
  }

  public async findOpenByCreator(guildId: string, creatorId: string): Promise<TicketRecord | null> {
    const { data, error } = await this.supabase
      .from('tickets')
      .select('*')
      .eq('guild_id', guildId)
      .eq('creator_id', creatorId)
      .eq('status', 'open')
      .order('opened_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to query open ticket by creator: ${error.message}`);
    }

    return data ? mapTicket(data) : null;
  }

  public async findByChannelId(channelId: string): Promise<TicketRecord | null> {
    const { data, error } = await this.supabase
      .from('tickets')
      .select('*')
      .eq('channel_id', channelId)
      .order('opened_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to query ticket by channel: ${error.message}`);
    }

    return data ? mapTicket(data) : null;
  }

  public async updateClaimState(
    channelId: string,
    claimedBy: string | null,
    claimedByTag: string | null,
  ): Promise<TicketRecord> {
    const { data, error } = await this.supabase
      .from('tickets')
      .update({
        claimed_by: claimedBy,
        claimed_by_tag: claimedByTag,
      })
      .eq('channel_id', channelId)
      .select('*')
      .single();

    if (error) {
      throw new Error(`Failed to update claim state: ${error.message}`);
    }

    return mapTicket(data);
  }

  public async replaceParticipants(channelId: string, participantIds: string[]): Promise<TicketRecord> {
    const { data, error } = await this.supabase
      .from('tickets')
      .update({
        participant_ids: participantIds,
      })
      .eq('channel_id', channelId)
      .select('*')
      .single();

    if (error) {
      throw new Error(`Failed to update participants: ${error.message}`);
    }

    return mapTicket(data);
  }

  public async updateAnswers(channelId: string, answers: any[]): Promise<TicketRecord> {
    const { data, error } = await this.supabase
      .from('tickets')
      .update({ answers })
      .eq('channel_id', channelId)
      .select('*')
      .single();

    if (error) {
      throw new Error(`Failed to update answers: ${error.message}`);
    }

    return mapTicket(data);
  }

  public async updateMetadata(channelId: string, metadata: Record<string, any>): Promise<TicketRecord> {
    const { data, error } = await this.supabase
      .from('tickets')
      .update({ metadata })
      .eq('channel_id', channelId)
      .select('*')
      .single();

    if (error) {
      throw new Error(`Failed to update metadata: ${error.message}`);
    }

    return mapTicket(data);
  }

  public async getStats(guildId: string): Promise<{ open: number; closed: number; total: number }> {
    const { count: open } = await this.supabase
      .from('tickets')
      .select('*', { count: 'exact', head: true })
      .eq('guild_id', guildId)
      .eq('status', 'open');

    const { count: closed } = await this.supabase
      .from('tickets')
      .select('*', { count: 'exact', head: true })
      .eq('guild_id', guildId)
      .eq('status', 'closed');

    const o = open ?? 0;
    const c = closed ?? 0;
    return { open: o, closed: c, total: o + c };
  }

  public async closeByChannel(channelId: string, input: CloseTicketInput): Promise<TicketRecord> {
    const { data, error } = await this.supabase
      .from('tickets')
      .update({
        status: 'closed',
        closed_at: new Date().toISOString(),
        closed_by: input.closed_by,
        closed_by_tag: input.closed_by_tag,
        close_reason: input.close_reason,
      })
      .eq('channel_id', channelId)
      .eq('status', 'open')
      .select('*')
      .single();

    if (error) {
      throw new Error(`Failed to close ticket: ${error.message}`);
    }

    return mapTicket(data);
  }

  public async findOpenTickets(guildId: string): Promise<TicketRecord[]> {
    const { data, error } = await this.supabase
      .from('tickets')
      .select('*')
      .eq('guild_id', guildId)
      .eq('status', 'open');

    if (error) {
      throw new Error(`Failed to query open tickets: ${error.message}`);
    }

    return (data || []).map(mapTicket);
  }

  public async getAIEnabled(): Promise<boolean> {
    const { data, error } = await this.supabase
      .from('ticket_counters')
      .select('current_value')
      .eq('key', 'ai_disabled')
      .maybeSingle();

    if (error) {
      return true; // Default to true on error
    }

    if (!data) return true; // Default to true if not set
    return Number(data.current_value) === 0;
  }

  public async setAIEnabled(enabled: boolean): Promise<void> {
    const { error } = await this.supabase
      .from('ticket_counters')
      .upsert({
        key: 'ai_disabled',
        current_value: enabled ? 0 : 1,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'key' });

    if (error) {
      throw new Error(`Failed to set AI status in DB: ${error.message}`);
    }
  }

  public async updateChannelInfo(
    oldChannelId: string,
    newChannelId: string,
    newChannelName: string,
    answers: any[],
    metadata: Record<string, any>
  ): Promise<TicketRecord> {
    const { data, error } = await this.supabase
      .from('tickets')
      .update({
        channel_id: newChannelId,
        channel_name: newChannelName,
        answers,
        metadata,
      })
      .eq('channel_id', oldChannelId)
      .select('*')
      .single();

    if (error) {
      throw new Error(`Failed to update channel info: ${error.message}`);
    }

    return mapTicket(data);
  }
}
