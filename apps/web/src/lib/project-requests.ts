import { decryptField, hashField } from './encryption';
import { isOwnerId } from './owner';
import { supabaseAdmin } from './supabase';

export type ProjectRequestRow = {
  id: string;
  requester_hash: string;
  requester_discord_id_enc: string;
  requester_name_enc: string | null;
  phone_enc: string | null;
  status: 'new' | 'open' | 'closed';
  owner_unread: boolean;
  customer_unread: boolean;
  created_at: string;
  last_message_at: string;
};

export type ProjectMessageRow = {
  id: string;
  sender_type: 'customer' | 'owner';
  content_enc: string;
  created_at: string;
};

export function canAccessProjectRequest(row: Pick<ProjectRequestRow, 'requester_hash'>, discordUserId: string) {
  return isOwnerId(discordUserId) || row.requester_hash === hashField(discordUserId);
}

export async function getAccessibleProjectRequest(id: string, discordUserId: string) {
  const { data, error } = await supabaseAdmin()
    .from('project_requests')
    .select('id,requester_hash,requester_discord_id_enc,requester_name_enc,phone_enc,status,owner_unread,customer_unread,created_at,last_message_at')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  const row = data as ProjectRequestRow | null;
  return row && canAccessProjectRequest(row, discordUserId) ? row : null;
}

export function publicProjectRequest(row: ProjectRequestRow) {
  return {
    id: row.id,
    requesterDiscordId: decryptField(row.requester_discord_id_enc),
    requesterName: row.requester_name_enc ? decryptField(row.requester_name_enc) : null,
    phone: row.phone_enc ? decryptField(row.phone_enc) : null,
    status: row.status,
    ownerUnread: row.owner_unread,
    customerUnread: row.customer_unread,
    createdAt: row.created_at,
    lastMessageAt: row.last_message_at,
  };
}

export function publicProjectMessage(row: ProjectMessageRow) {
  return {
    id: row.id,
    senderType: row.sender_type,
    content: decryptField(row.content_enc),
    createdAt: row.created_at,
  };
}
