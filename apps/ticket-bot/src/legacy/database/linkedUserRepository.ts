import type { SupabaseClient } from '@supabase/supabase-js';
import { logger } from '../utils/logger.js';

export interface LinkedUserRecord {
  id: string;
  discord_id: string;
  discord_username: string;
  discord_display_name: string | null;
  discord_avatar_url: string | null;
  discord_global_name: string | null;
  email_encrypted: string | null;
  phone_encrypted: string | null;
  linked_at: string;
  updated_at: string;
}

const TABLE_NAME = 'linked_users';

export class LinkedUserRepository {
  private tableInitialized = false;

  public constructor(private readonly supabase: SupabaseClient) {}

  /**
   * Ensure the linked_users table exists.
   * Logs a warning if the table is missing — the SQL migration must be run manually first.
   */
  public async ensureTable(): Promise<void> {
    if (this.tableInitialized) return;

    try {
      const { error } = await this.supabase
        .from(TABLE_NAME)
        .select('id')
        .limit(1);

      if (error && error.code === '42P01') {
        logger.warn(
          '[linked_users] Table does not exist. Run supabase/linked_users.sql manually.',
        );
      }
    } catch {
      // Ignore — let actual queries fail naturally
    }

    // Mark as initialized to avoid repeated checks
    this.tableInitialized = true;
  }

  /**
   * Save or update a linked user record.
   * Uses upsert to handle re-linking (updates existing record).
   */
  public async upsertUser(input: {
    discordId: string;
    discordUsername: string;
    discordDisplayName: string | null;
    discordAvatarUrl: string | null;
    discordGlobalName: string | null;
    emailEncrypted?: string | null;
    phoneEncrypted?: string | null;
  }): Promise<LinkedUserRecord> {
    await this.ensureTable();

    const existing = await this.findByDiscordId(input.discordId);
    const payload: Record<string, unknown> = {
      discord_id: input.discordId,
      discord_username: input.discordUsername,
      discord_display_name: input.discordDisplayName,
      discord_avatar_url: input.discordAvatarUrl,
      discord_global_name: input.discordGlobalName,
    };

    // Preserve existing sensitive data unless caller explicitly provides a value/null.
    if (Object.prototype.hasOwnProperty.call(input, 'emailEncrypted')) {
      payload.email_encrypted = input.emailEncrypted ?? null;
    } else if (!existing) {
      payload.email_encrypted = null;
    }

    if (Object.prototype.hasOwnProperty.call(input, 'phoneEncrypted')) {
      payload.phone_encrypted = input.phoneEncrypted ?? null;
    } else if (!existing) {
      payload.phone_encrypted = null;
    }

    if (existing) {
      const { data, error } = await this.supabase
        .from(TABLE_NAME)
        .update(payload)
        .eq('discord_id', input.discordId)
        .select('*')
        .single();

      if (error) throw new Error(`Failed to update linked user: ${error.message}`);
      return data as LinkedUserRecord;
    }

    const { data, error } = await this.supabase
      .from(TABLE_NAME)
      .insert(payload)
      .select('*')
      .single();

    if (error) throw new Error(`Failed to insert linked user: ${error.message}`);
    return data as LinkedUserRecord;
  }

  /**
   * Find a linked user by their Discord ID.
   */
  public async findByDiscordId(discordId: string): Promise<LinkedUserRecord | null> {
    await this.ensureTable();

    const { data, error } = await this.supabase
      .from(TABLE_NAME)
      .select('*')
      .eq('discord_id', discordId)
      .maybeSingle();

    if (error) throw new Error(`Failed to query linked user: ${error.message}`);
    return data as LinkedUserRecord | null;
  }

  /**
   * Update email and phone for an already-linked user.
   */
  public async updateSensitiveData(discordId: string, emailEncrypted: string | null, phoneEncrypted: string | null): Promise<void> {
    await this.ensureTable();

    const { error } = await this.supabase
      .from(TABLE_NAME)
      .update({
        email_encrypted: emailEncrypted,
        phone_encrypted: phoneEncrypted,
      })
      .eq('discord_id', discordId);

    if (error) throw new Error(`Failed to update sensitive data: ${error.message}`);
  }

  /**
   * Delete a linked user record.
   */
  public async deleteByDiscordId(discordId: string): Promise<void> {
    await this.ensureTable();

    const { error } = await this.supabase
      .from(TABLE_NAME)
      .delete()
      .eq('discord_id', discordId);

    if (error) throw new Error(`Failed to delete linked user: ${error.message}`);
  }

  /**
   * List all linked users (ordered by most recently linked).
   */
  public async listAll(limit = 100, offset = 0): Promise<LinkedUserRecord[]> {
    await this.ensureTable();

    const { data, error } = await this.supabase
      .from(TABLE_NAME)
      .select('*')
      .order('linked_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw new Error(`Failed to list linked users: ${error.message}`);
    return (data ?? []) as LinkedUserRecord[];
  }

  /**
   * Get the total count of linked users.
   */
  public async countAll(): Promise<number> {
    await this.ensureTable();

    const { count, error } = await this.supabase
      .from(TABLE_NAME)
      .select('id', { count: 'exact', head: true });

    if (error) throw new Error(`Failed to count linked users: ${error.message}`);
    return count ?? 0;
  }
}
