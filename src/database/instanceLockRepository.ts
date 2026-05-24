import type { SupabaseClient } from '@supabase/supabase-js';

export interface InstanceLockRecord {
  guild_id: string;
  instance_id: string;
  updated_at: string;
}

export class InstanceLockRepository {
  public constructor(private readonly supabase: SupabaseClient) {}

  public async find(guildId: string): Promise<InstanceLockRecord | null> {
    const { data, error } = await this.supabase
      .from('bot_instance_locks')
      .select('*')
      .eq('guild_id', guildId)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to query instance lock: ${error.message}`);
    }

    return data as InstanceLockRecord | null;
  }

  public async upsert(guildId: string, instanceId: string): Promise<void> {
    const { error } = await this.supabase
      .from('bot_instance_locks')
      .upsert({
        guild_id: guildId,
        instance_id: instanceId,
      }, { onConflict: 'guild_id' });

    if (error) {
      throw new Error(`Failed to upsert instance lock: ${error.message}`);
    }
  }

  public async release(guildId: string, instanceId: string): Promise<void> {
    const { error } = await this.supabase
      .from('bot_instance_locks')
      .delete()
      .eq('guild_id', guildId)
      .eq('instance_id', instanceId);

    if (error) {
      throw new Error(`Failed to release instance lock: ${error.message}`);
    }
  }
}
