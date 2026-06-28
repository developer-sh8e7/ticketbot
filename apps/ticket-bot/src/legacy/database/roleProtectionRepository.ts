import type { SupabaseClient } from '@supabase/supabase-js';

export interface ProtectedRoleState {
  guild_id: string;
  source_role_id: string;
  current_role_id: string;
  role_name: string;
  role_color: number | null;
  role_hoist: boolean;
  role_mentionable: boolean;
  role_permissions: string;
  role_position: number;
  updated_at: string;
}

export interface UpsertProtectedRoleStateInput {
  guild_id: string;
  source_role_id: string;
  current_role_id: string;
  role_name: string;
  role_color: number | null;
  role_hoist: boolean;
  role_mentionable: boolean;
  role_permissions: string;
  role_position: number;
}

export class RoleProtectionRepository {
  public constructor(private readonly supabase: SupabaseClient) {}

  public async findState(guildId: string, sourceRoleId: string): Promise<ProtectedRoleState | null> {
    const { data, error } = await this.supabase
      .from('protected_role_state')
      .select('*')
      .eq('guild_id', guildId)
      .eq('source_role_id', sourceRoleId)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to query protected role state: ${error.message}`);
    }

    return data as ProtectedRoleState | null;
  }

  public async upsertState(input: UpsertProtectedRoleStateInput): Promise<void> {
    const { error } = await this.supabase
      .from('protected_role_state')
      .upsert(input, { onConflict: 'guild_id,source_role_id' });

    if (error) {
      throw new Error(`Failed to upsert protected role state: ${error.message}`);
    }
  }

  public async replaceMembers(guildId: string, sourceRoleId: string, userIds: string[]): Promise<void> {
    if (userIds.length === 0) {
      return;
    }

    const rows = userIds.map((userId) => ({
      guild_id: guildId,
      source_role_id: sourceRoleId,
      user_id: userId,
    }));

    const { error } = await this.supabase
      .from('protected_role_members')
      .upsert(rows, { onConflict: 'guild_id,source_role_id,user_id' });

    if (error) {
      throw new Error(`Failed to upsert protected role members: ${error.message}`);
    }
  }

  public async addMember(guildId: string, sourceRoleId: string, userId: string): Promise<void> {
    const { error } = await this.supabase
      .from('protected_role_members')
      .upsert({ guild_id: guildId, source_role_id: sourceRoleId, user_id: userId }, {
        onConflict: 'guild_id,source_role_id,user_id',
      });

    if (error) {
      throw new Error(`Failed to add protected role member: ${error.message}`);
    }
  }

  public async removeMember(guildId: string, sourceRoleId: string, userId: string): Promise<void> {
    const { error } = await this.supabase
      .from('protected_role_members')
      .delete()
      .eq('guild_id', guildId)
      .eq('source_role_id', sourceRoleId)
      .eq('user_id', userId);

    if (error) {
      throw new Error(`Failed to remove protected role member: ${error.message}`);
    }
  }

  public async listMemberIds(guildId: string, sourceRoleId: string): Promise<string[]> {
    const { data, error } = await this.supabase
      .from('protected_role_members')
      .select('user_id')
      .eq('guild_id', guildId)
      .eq('source_role_id', sourceRoleId);

    if (error) {
      throw new Error(`Failed to list protected role members: ${error.message}`);
    }

    return (data as { user_id: string }[] | null)?.map((row) => row.user_id) ?? [];
  }
}
