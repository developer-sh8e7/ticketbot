import type { TicketAnswer } from '../types/config.js';

export type TicketStatus = 'open' | 'closed';

export interface TicketRecord {
  id: string;
  ticket_number: number;
  guild_id: string;
  channel_id: string | null;
  channel_name: string | null;
  creator_id: string;
  creator_tag: string;
  category_key: string;
  category_label: string;
  status: TicketStatus;
  claimed_by: string | null;
  claimed_by_tag: string | null;
  participant_ids: string[];
  answers: TicketAnswer[];
  metadata: Record<string, unknown>;
  opened_at: string;
  updated_at: string;
  closed_at: string | null;
  closed_by: string | null;
  closed_by_tag: string | null;
  close_reason: string | null;
}

export interface CreateTicketRecordInput {
  ticket_number: number;
  guild_id: string;
  channel_id: string;
  channel_name: string;
  creator_id: string;
  creator_tag: string;
  category_key: string;
  category_label: string;
  participant_ids: string[];
  answers: TicketAnswer[];
  metadata: Record<string, unknown>;
}

export interface CloseTicketInput {
  closed_by: string;
  closed_by_tag: string;
  close_reason: string | null;
}
