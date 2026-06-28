import type { SupabaseClient } from '@supabase/supabase-js';

export interface RoleManagementAuthorizedUserRecord {
  guild_id: string;
  user_id: string;
  granted_by: string;
  created_at?: string;
  updated_at?: string;
}

export interface RoleManagementAllowedRoleRecord {
  guild_id: string;
  role_id: string;
  updated_by: string;
  created_at?: string;
  updated_at?: string;
}

export class RoleManagementRepository {
  public constructor(private readonly supabase: SupabaseClient) {}

  public async isAuthorized(guildId: string, userId: string): Promise<boolean> {
    const { data, error } = await this.supabase
      .from('role_management_authorized_users')
      .select('user_id')
      .eq('guild_id', guildId)
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to query role management authorization: ${error.message}`);
    }

    return Boolean(data);
  }

  public async listAuthorizedUsers(guildId: string): Promise<RoleManagementAuthorizedUserRecord[]> {
    const { data, error } = await this.supabase
      .from('role_management_authorized_users')
      .select('guild_id,user_id,granted_by,created_at,updated_at')
      .eq('guild_id', guildId)
      .order('created_at', { ascending: true });

    if (error) {
      throw new Error(`Failed to list role management authorizations: ${error.message}`);
    }

    return (data ?? []) as RoleManagementAuthorizedUserRecord[];
  }

  public async authorizeUser(guildId: string, userId: string, grantedBy: string): Promise<void> {
    const { error } = await this.supabase
      .from('role_management_authorized_users')
      .upsert({
        guild_id: guildId,
        user_id: userId,
        granted_by: grantedBy,
      }, { onConflict: 'guild_id,user_id' });

    if (error) {
      throw new Error(`Failed to authorize role manager: ${error.message}`);
    }
  }

  public async revokeUser(guildId: string, userId: string): Promise<void> {
    const { error } = await this.supabase
      .from('role_management_authorized_users')
      .delete()
      .eq('guild_id', guildId)
      .eq('user_id', userId);

    if (error) {
      throw new Error(`Failed to revoke role manager authorization: ${error.message}`);
    }
  }

  public async clearAuthorizedUsers(guildId: string): Promise<void> {
    const { error } = await this.supabase
      .from('role_management_authorized_users')
      .delete()
      .eq('guild_id', guildId);

    if (error) {
      throw new Error(`Failed to clear role manager authorizations: ${error.message}`);
    }
  }

  public async listAllowedRoleIds(guildId: string): Promise<string[]> {
    const { data, error } = await this.supabase
      .from('role_management_allowed_roles')
      .select('role_id')
      .eq('guild_id', guildId)
      .order('created_at', { ascending: true });

    if (error) {
      throw new Error(`Failed to list role management allowed roles: ${error.message}`);
    }

    return (data ?? [])
      .map((row) => (row as { role_id?: string }).role_id)
      .filter((roleId): roleId is string => Boolean(roleId));
  }

  public async setAllowedRoleIds(guildId: string, roleIds: string[], updatedBy: string): Promise<void> {
    const uniqueRoleIds = [...new Set(roleIds.filter(Boolean))];

    const { error: deleteError } = await this.supabase
      .from('role_management_allowed_roles')
      .delete()
      .eq('guild_id', guildId);

    if (deleteError) {
      throw new Error(`Failed to clear role management allowed roles: ${deleteError.message}`);
    }

    if (uniqueRoleIds.length === 0) {
      return;
    }

    const { error: insertError } = await this.supabase
      .from('role_management_allowed_roles')
      .insert(uniqueRoleIds.map((roleId) => ({ guild_id: guildId, role_id: roleId, updated_by: updatedBy })));

    if (insertError) {
      throw new Error(`Failed to save role management allowed roles: ${insertError.message}`);
    }
  }

  public async getDailyCount(guildId: string, actorId: string, roleId: string, dayKey: string): Promise<number> {
    const { data, error } = await this.supabase
      .from('role_management_daily_limits')
      .select('used_count')
      .eq('guild_id', guildId)
      .eq('actor_id', actorId)
      .eq('role_id', roleId)
      .eq('day_key', dayKey)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to query role management daily limit: ${error.message}`);
    }

    return Number((data as { used_count?: number } | null)?.used_count ?? 0);
  }

  public async setDailyCount(guildId: string, actorId: string, roleId: string, dayKey: string, count: number): Promise<void> {
    const { error } = await this.supabase
      .from('role_management_daily_limits')
      .upsert({
        guild_id: guildId,
        actor_id: actorId,
        role_id: roleId,
        day_key: dayKey,
        used_count: count,
      }, { onConflict: 'guild_id,actor_id,role_id,day_key' });

    if (error) {
      throw new Error(`Failed to update role management daily limit: ${error.message}`);
    }
  }
}
