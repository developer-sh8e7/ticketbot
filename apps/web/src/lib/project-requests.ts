import { decryptField, hashField, verifyFieldHash } from './encryption';
import { isOwnerId } from './owner';
import { supabaseAdmin } from './supabase';

export type ProjectRequestRow = {
  id: string;
  requester_hash: string;
  access_token_hash: string | null;
  requester_discord_id_enc: string | null;
  requester_name_enc: string | null;
  phone_enc: string | null;
  status: 'new' | 'open' | 'closed';
  owner_unread: boolean;
  customer_unread: boolean;
  customer_typing_until: string | null;
  owner_typing_until: string | null;
  created_at: string;
  last_message_at: string;
};

export type ProjectMessageRow = {
  id: string;
  sender_type: 'customer' | 'owner';
  content_enc: string;
  created_at: string;
};

export const PROJECT_REQUEST_FIELDS = 'id,requester_hash,access_token_hash,requester_discord_id_enc,requester_name_enc,phone_enc,status,owner_unread,customer_unread,customer_typing_until,owner_typing_until,created_at,last_message_at';

export function canAccessProjectRequest(
  row: Pick<ProjectRequestRow, 'requester_hash' | 'access_token_hash'>,
  discordUserId?: string | null,
  guestToken?: string | null,
) {
  if (discordUserId && (isOwnerId(discordUserId) || row.requester_hash === hashField(discordUserId))) return true;
  return Boolean(guestToken && row.access_token_hash && verifyFieldHash(guestToken, row.access_token_hash));
}

export async function getAccessibleProjectRequest(id: string, discordUserId?: string | null, guestToken?: string | null) {
  const { data, error } = await supabaseAdmin()
    .from('project_requests')
    .select(PROJECT_REQUEST_FIELDS)
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  const row = data as ProjectRequestRow | null;
  return row && canAccessProjectRequest(row, discordUserId, guestToken) ? row : null;
}

export function publicProjectRequest(row: ProjectRequestRow) {
  return {
    id: row.id,
    requesterDiscordId: row.requester_discord_id_enc ? decryptField(row.requester_discord_id_enc) : null,
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
