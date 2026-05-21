import type { SupabaseClient } from '@supabase/supabase-js';

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
