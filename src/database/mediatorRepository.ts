import type { SupabaseClient } from '@supabase/supabase-js';

export interface MediatorRecord {
  user_id: string;
  username: string;
  status: 'trial' | 'trusted' | 'removed';
  assigned_by: string;
  assigned_by_tag: string;
  assigned_at: string;
  assigned_reason: string | null;
  trial_period: string | null;
  notes: string | null;
  promoted_by: string | null;
  promoted_by_tag: string | null;
  promoted_at: string | null;
  removed_by: string | null;
  removed_by_tag: string | null;
  removed_at: string | null;
  removed_reason: string | null;
  tickets_claimed: number;
  tickets_completed: number;
  complaints_count: number;
  is_active: boolean;
  updated_at: string;
}

export interface MediatorHistoryRecord {
  id: string;
  user_id: string;
  username: string;
  action: 'assign' | 'promote' | 'remove' | 'update';
  actor_id: string;
  actor_tag: string;
  reason: string | null;
  details: Record<string, any>;
  created_at: string;
}

export interface MediatorVerificationRecord {
  id: string;
  discord_id: string;
  discord_username: string;
  discord_display_name: string | null;
  phone_hash: string | null;
  is_fully_verified: boolean;
  verification_token: string | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
  verified_at: string | null;
}

export interface VerificationStatus {
  isFullyVerified: boolean;
  verifiedAt: string | null;
}

export interface ValidOtpRecord {
  id: string;
  otp_hash: string;
  attempts: number;
}

export interface LatestOtpRecord {
  created_at: string;
}

// In-memory fallback storage
const inMemoryMediators = new Map<string, MediatorRecord>();
const inMemoryHistory: MediatorHistoryRecord[] = [];

export class MediatorRepository {
  public constructor(private readonly supabase: SupabaseClient) {}

  public get client(): SupabaseClient {
    return this.supabase;
  }

  private handleDbError(error: any, context: string): void {
    if (error.code === '42P01') {
      console.warn(`[MediatorRepository] Table missing during "${context}". Falling back to in-memory storage. Please run 'supabase/mediators.sql' in your Supabase SQL Editor. Details: ${error.message}`);
    } else {
      console.error(`[MediatorRepository] Database error during "${context}":`, error.message);
    }
  }

  public async getMediator(userId: string): Promise<MediatorRecord | null> {
    try {
      const { data, error } = await this.supabase
        .from('mediators')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) {
        this.handleDbError(error, `getMediator (${userId})`);
        return inMemoryMediators.get(userId) || null;
      }

      if (data) {
        // Sync in-memory cache
        inMemoryMediators.set(userId, data as MediatorRecord);
        return data as MediatorRecord;
      }

      return null;
    } catch (err) {
      console.error(`[MediatorRepository] Exception in getMediator:`, err);
      return inMemoryMediators.get(userId) || null;
    }
  }

  public async createMediator(input: {
    user_id: string;
    username: string;
    status: 'trial' | 'trusted';
    assigned_by: string;
    assigned_by_tag: string;
    assigned_reason?: string;
    trial_period?: string;
    notes?: string;
  }): Promise<MediatorRecord> {
    const record: Omit<MediatorRecord, 'updated_at'> = {
      user_id: input.user_id,
      username: input.username,
      status: input.status,
      assigned_by: input.assigned_by,
      assigned_by_tag: input.assigned_by_tag,
      assigned_at: new Date().toISOString(),
      assigned_reason: input.assigned_reason || null,
      trial_period: input.trial_period || null,
      notes: input.notes || null,
      promoted_by: null,
      promoted_by_tag: null,
      promoted_at: null,
      removed_by: null,
      removed_by_tag: null,
      removed_at: null,
      removed_reason: null,
      tickets_claimed: 0,
      tickets_completed: 0,
      complaints_count: 0,
      is_active: true,
    };

    try {
      const { data, error } = await this.supabase
        .from('mediators')
        .insert({
          ...record,
          updated_at: new Date().toISOString(),
        })
        .select('*')
        .single();

      if (error) {
        this.handleDbError(error, 'createMediator');
        const fullRecord: MediatorRecord = { ...record, updated_at: new Date().toISOString() };
        inMemoryMediators.set(input.user_id, fullRecord);
        return fullRecord;
      }

      inMemoryMediators.set(input.user_id, data as MediatorRecord);
      return data as MediatorRecord;
    } catch (err) {
      console.error(`[MediatorRepository] Exception in createMediator:`, err);
      const fullRecord: MediatorRecord = { ...record, updated_at: new Date().toISOString() };
      inMemoryMediators.set(input.user_id, fullRecord);
      return fullRecord;
    }
  }

  public async updateMediator(userId: string, updates: Partial<MediatorRecord>): Promise<MediatorRecord> {
    try {
      const { data, error } = await this.supabase
        .from('mediators')
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', userId)
        .select('*')
        .single();

      if (error) {
        this.handleDbError(error, `updateMediator (${userId})`);
        const existing = inMemoryMediators.get(userId) || {
          user_id: userId,
          username: 'Unknown',
          status: 'trial',
          assigned_by: 'system',
          assigned_by_tag: 'system',
          assigned_at: new Date().toISOString(),
          assigned_reason: null,
          trial_period: null,
          notes: null,
          promoted_by: null,
          promoted_by_tag: null,
          promoted_at: null,
          removed_by: null,
          removed_by_tag: null,
          removed_at: null,
          removed_reason: null,
          tickets_claimed: 0,
          tickets_completed: 0,
          complaints_count: 0,
          is_active: true,
          updated_at: new Date().toISOString(),
        };

        const merged: MediatorRecord = {
          ...existing,
          ...updates,
          updated_at: new Date().toISOString(),
        };
        inMemoryMediators.set(userId, merged);
        return merged;
      }

      inMemoryMediators.set(userId, data as MediatorRecord);
      return data as MediatorRecord;
    } catch (err) {
      console.error(`[MediatorRepository] Exception in updateMediator:`, err);
      const existing = inMemoryMediators.get(userId)!;
      const merged: MediatorRecord = {
        ...existing,
        ...updates,
        updated_at: new Date().toISOString(),
      };
      inMemoryMediators.set(userId, merged);
      return merged;
    }
  }

  public async listMediators(): Promise<MediatorRecord[]> {
    try {
      const { data, error } = await this.supabase
        .from('mediators')
        .select('*')
        .order('assigned_at', { ascending: false });

      if (error) {
        this.handleDbError(error, 'listMediators');
        return Array.from(inMemoryMediators.values());
      }

      // Sync cache
      for (const row of data || []) {
        inMemoryMediators.set(row.user_id, row as MediatorRecord);
      }

      return (data || []) as MediatorRecord[];
    } catch (err) {
      console.error(`[MediatorRepository] Exception in listMediators:`, err);
      return Array.from(inMemoryMediators.values());
    }
  }

  public async logHistory(input: {
    user_id: string;
    username: string;
    action: 'assign' | 'promote' | 'remove' | 'update';
    actor_id: string;
    actor_tag: string;
    reason?: string;
    details?: Record<string, any>;
  }): Promise<void> {
    const historyItem: MediatorHistoryRecord = {
      id: crypto.randomUUID(),
      user_id: input.user_id,
      username: input.username,
      action: input.action,
      actor_id: input.actor_id,
      actor_tag: input.actor_tag,
      reason: input.reason || null,
      details: input.details || {},
      created_at: new Date().toISOString(),
    };

    try {
      const { error } = await this.supabase
        .from('mediator_history')
        .insert(historyItem);

      if (error) {
        this.handleDbError(error, 'logHistory');
        inMemoryHistory.push(historyItem);
      }
    } catch (err) {
      console.error(`[MediatorRepository] Exception in logHistory:`, err);
      inMemoryHistory.push(historyItem);
    }
  }

  public async listHistory(): Promise<MediatorHistoryRecord[]> {
    try {
      const { data, error } = await this.supabase
        .from('mediator_history')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        this.handleDbError(error, 'listHistory');
        return inMemoryHistory.slice().reverse();
      }

      return (data || []) as MediatorHistoryRecord[];
    } catch (err) {
      console.error(`[MediatorRepository] Exception in listHistory:`, err);
      return inMemoryHistory.slice().reverse();
    }
  }

  public async checkVerificationStatus(discordId: string): Promise<VerificationStatus | null> {
    const { data, error } = await this.supabase
      .from('mediator_verification')
      .select('is_fully_verified, verified_at')
      .eq('discord_id', discordId)
      .maybeSingle();

    if (error) {
      this.handleDbError(error, `checkVerificationStatus (${discordId})`);
      return null;
    }

    if (!data) return null;
    return {
      isFullyVerified: Boolean(data.is_fully_verified),
      verifiedAt: data.verified_at ?? null,
    };
  }

  public async upsertUser(
    discordId: string,
    username: string,
    displayName: string | null,
    ipAddress: string,
    userAgent: string,
  ): Promise<void> {
    const { error } = await this.supabase
      .from('mediator_verification')
      .upsert({
        discord_id: discordId,
        discord_username: username,
        discord_display_name: displayName,
        ip_address: ipAddress,
        user_agent: userAgent,
      }, { onConflict: 'discord_id' });

    if (error) {
      this.handleDbError(error, `upsertUser (${discordId})`);
    }
  }

  public async setVerificationToken(discordId: string, token: string): Promise<void> {
    const { error } = await this.supabase
      .from('mediator_verification')
      .update({ verification_token: token })
      .eq('discord_id', discordId);

    if (error) {
      this.handleDbError(error, `setVerificationToken (${discordId})`);
    }
  }

  public async updatePhoneVerified(discordId: string, phoneHash: string): Promise<void> {
    const { error } = await this.supabase
      .from('mediator_verification')
      .update({
        phone_hash: phoneHash,
        is_fully_verified: true,
        verified_at: new Date().toISOString(),
      })
      .eq('discord_id', discordId);

    if (error) {
      this.handleDbError(error, `updatePhoneVerified (${discordId})`);
    }
  }

  public async isPhoneHashTaken(phoneHash: string): Promise<boolean> {
    const { data, error } = await this.supabase
      .from('mediator_verification')
      .select('discord_id')
      .eq('phone_hash', phoneHash)
      .maybeSingle();

    if (error) {
      this.handleDbError(error, 'isPhoneHashTaken');
      return false;
    }

    return Boolean(data);
  }

  public async saveOtp(phoneHash: string, otpHash: string, discordId: string, expiresAt: Date): Promise<void> {
    const { error } = await this.supabase
      .from('mediator_otp_records')
      .insert({
        phone_hash: phoneHash,
        otp_hash: otpHash,
        discord_id: discordId,
        expires_at: expiresAt.toISOString(),
      });

    if (error) {
      this.handleDbError(error, `saveOtp (${discordId})`);
    }
  }

  public async invalidateOtps(phoneHash: string, discordId: string): Promise<void> {
    const { error } = await this.supabase
      .from('mediator_otp_records')
      .update({ used: true })
      .eq('phone_hash', phoneHash)
      .eq('discord_id', discordId)
      .eq('used', false);

    if (error) {
      this.handleDbError(error, `invalidateOtps (${discordId})`);
    }
  }

  public async getLatestOtp(phoneHash: string, discordId: string): Promise<LatestOtpRecord | null> {
    const { data, error } = await this.supabase
      .from('mediator_otp_records')
      .select('created_at')
      .eq('phone_hash', phoneHash)
      .eq('discord_id', discordId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      this.handleDbError(error, `getLatestOtp (${discordId})`);
      return null;
    }

    return data as LatestOtpRecord | null;
  }

  public async getValidOtp(phoneHash: string): Promise<ValidOtpRecord | null> {
    const { data, error } = await this.supabase
      .from('mediator_otp_records')
      .select('id, otp_hash, attempts')
      .eq('phone_hash', phoneHash)
      .eq('used', false)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      this.handleDbError(error, 'getValidOtp');
      return null;
    }

    return data as ValidOtpRecord | null;
  }

  public async incrementAttempts(otpId: string): Promise<void> {
    const { data, error: fetchError } = await this.supabase
      .from('mediator_otp_records')
      .select('attempts')
      .eq('id', otpId)
      .maybeSingle();

    if (fetchError) {
      this.handleDbError(fetchError, `incrementAttempts fetch (${otpId})`);
      return;
    }

    const attempts = Number(data?.attempts ?? 0) + 1;
    const { error } = await this.supabase
      .from('mediator_otp_records')
      .update({ attempts })
      .eq('id', otpId);

    if (error) {
      this.handleDbError(error, `incrementAttempts (${otpId})`);
    }
  }

  public async markOtpUsed(otpId: string): Promise<void> {
    const { error } = await this.supabase
      .from('mediator_otp_records')
      .update({ used: true })
      .eq('id', otpId);

    if (error) {
      this.handleDbError(error, `markOtpUsed (${otpId})`);
    }
  }

  public async getUserInfo(discordId: string): Promise<MediatorVerificationRecord | null> {
    const { data, error } = await this.supabase
      .from('mediator_verification')
      .select('*')
      .eq('discord_id', discordId)
      .maybeSingle();

    if (error) {
      this.handleDbError(error, `getUserInfo (${discordId})`);
      return null;
    }

    return data as MediatorVerificationRecord | null;
  }

  public async getUserByToken(token: string): Promise<MediatorVerificationRecord | null> {
    const { data, error } = await this.supabase
      .from('mediator_verification')
      .select('*')
      .eq('verification_token', token)
      .maybeSingle();

    if (error) {
      this.handleDbError(error, 'getUserByToken');
      return null;
    }

    return data as MediatorVerificationRecord | null;
  }

  public async logRateLimit(ipAddress: string, endpoint: string): Promise<void> {
    const { error } = await this.supabase
      .from('rate_limit_log')
      .insert({
        ip_address: ipAddress,
        endpoint,
      });

    if (error) {
      this.handleDbError(error, `logRateLimit (${endpoint})`);
    }
  }

  public async getRateLimitCount(ipAddress: string, endpoint: string, windowMs: number): Promise<number> {
    const since = new Date(Date.now() - windowMs).toISOString();
    const { count, error } = await this.supabase
      .from('rate_limit_log')
      .select('id', { count: 'exact', head: true })
      .eq('ip_address', ipAddress)
      .eq('endpoint', endpoint)
      .gte('hit_at', since);

    if (error) {
      this.handleDbError(error, `getRateLimitCount (${endpoint})`);
      return 0;
    }

    return count ?? 0;
  }
}
