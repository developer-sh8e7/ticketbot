import type { SupabaseClient } from '@supabase/supabase-js';
import { logger } from '../utils/logger.js';

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
  discord_avatar_url: string | null;
  phone_hash: string | null;
  phone_lookup_hash: string | null;
  is_fully_verified: boolean;
  verification_token: string | null;
  jwt_jti_hash: string | null;
  jwt_expires_at: string | null;
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

export interface MediatorConfigRecord {
  id: string;
  is_open: boolean;
  current_count: number;
  max_count: number;
  required_weapon: string;
  updated_at: string;
}

export interface MediatorApplicationRecord {
  id: string;
  guild_id: string;
  channel_id: string;
  message_id: string | null;
  applicant_id: string;
  applicant_tag: string;
  verified_at: string | null;
  status: 'open' | 'accepted' | 'rejected' | 'closed';
  decided_by: string | null;
  decision_notes: string | null;
  rejection_reason: string | null;
  opened_at: string;
  decided_at: string | null;
  closed_at: string | null;
  updated_at: string;
}

const DEFAULT_MEDIATOR_CONFIG: MediatorConfigRecord = {
  id: '00000000-0000-0000-0000-000000000000',
  is_open: false,
  current_count: 6,
  max_count: 6,
  required_weapon: 'مدفع كريسمس',
  updated_at: new Date(0).toISOString(),
};

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
      logger.warn('Mediator table is missing; using in-memory fallback.', {
        context,
        message: error.message,
      });
    } else {
      logger.error('Mediator repository database error.', {
        context,
        message: error.message,
      });
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
      logger.error('Mediator repository get failed.', err);
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
      logger.error('Mediator repository create failed.', err);
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
      logger.error('Mediator repository update failed.', err);
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
      logger.error('Mediator repository list failed.', err);
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
      logger.error('Mediator history write failed.', err);
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
      logger.error('Mediator history list failed.', err);
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
    avatarUrl: string | null,
    ipAddress: string,
    userAgent: string,
  ): Promise<void> {
    const { error } = await this.supabase
      .from('mediator_verification')
      .upsert({
        discord_id: discordId,
        discord_username: username,
        discord_display_name: displayName,
        discord_avatar_url: avatarUrl,
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

  public async setVerificationSession(
    discordId: string,
    token: string,
    jtiHash: string,
    expiresAt: Date,
  ): Promise<void> {
    const { error } = await this.supabase
      .from('mediator_verification')
      .update({
        verification_token: token,
        jwt_jti_hash: jtiHash,
        jwt_expires_at: expiresAt.toISOString(),
      })
      .eq('discord_id', discordId);

    if (error) {
      this.handleDbError(error, `setVerificationSession (${discordId})`);
      throw new Error('Failed to persist verification session');
    }
  }

  public async updatePhoneVerified(
    discordId: string,
    phoneHash: string,
    phoneLookupHash: string,
  ): Promise<void> {
    const { error } = await this.supabase
      .from('mediator_verification')
      .update({
        phone_hash: phoneHash,
        phone_lookup_hash: phoneLookupHash,
        is_fully_verified: true,
        verified_at: new Date().toISOString(),
      })
      .eq('discord_id', discordId);

    if (error) {
      this.handleDbError(error, `updatePhoneVerified (${discordId})`);
      throw new Error('Failed to persist phone verification');
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

  public async isPhoneLookupHashTaken(phoneLookupHash: string): Promise<boolean> {
    const { data, error } = await this.supabase
      .from('mediator_verification')
      .select('discord_id')
      .eq('phone_lookup_hash', phoneLookupHash)
      .maybeSingle();

    if (error) {
      this.handleDbError(error, 'isPhoneLookupHashTaken');
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

  public async getValidOtp(phoneHash: string, discordId: string): Promise<ValidOtpRecord | null> {
    const { data, error } = await this.supabase
      .from('mediator_otp_records')
      .select('id, otp_hash, attempts')
      .eq('phone_hash', phoneHash)
      .eq('discord_id', discordId)
      .eq('used', false)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      this.handleDbError(error, `getValidOtp (${discordId})`);
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

  public async getUserByJtiHash(jtiHash: string): Promise<MediatorVerificationRecord | null> {
    const { data, error } = await this.supabase
      .from('mediator_verification')
      .select('*')
      .eq('jwt_jti_hash', jtiHash)
      .gt('jwt_expires_at', new Date().toISOString())
      .maybeSingle();

    if (error) {
      this.handleDbError(error, 'getUserByJtiHash');
      return null;
    }

    return data as MediatorVerificationRecord | null;
  }

  public async getMediatorConfig(): Promise<MediatorConfigRecord> {
    const { data, error } = await this.supabase
      .from('mediator_config')
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      this.handleDbError(error, 'getMediatorConfig');
      return DEFAULT_MEDIATOR_CONFIG;
    }

    return (data as MediatorConfigRecord | null) ?? DEFAULT_MEDIATOR_CONFIG;
  }

  public async updateMediatorConfig(
    updates: Partial<Pick<MediatorConfigRecord, 'is_open' | 'current_count' | 'max_count' | 'required_weapon'>>,
  ): Promise<MediatorConfigRecord> {
    const current = await this.getMediatorConfig();
    if (current.id === DEFAULT_MEDIATOR_CONFIG.id) {
      const { data, error } = await this.supabase
        .from('mediator_config')
        .insert({
          is_open: updates.is_open ?? current.is_open,
          current_count: updates.current_count ?? current.current_count,
          max_count: updates.max_count ?? current.max_count,
          required_weapon: updates.required_weapon ?? current.required_weapon,
        })
        .select('*')
        .single();

      if (error) {
        this.handleDbError(error, 'createMediatorConfig');
        throw new Error('Mediator configuration table is unavailable');
      }
      return data as MediatorConfigRecord;
    }

    const { data, error } = await this.supabase
      .from('mediator_config')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', current.id)
      .select('*')
      .single();

    if (error) {
      this.handleDbError(error, 'updateMediatorConfig');
      throw new Error('Failed to update mediator configuration');
    }

    return data as MediatorConfigRecord;
  }

  public async incrementMediatorCount(): Promise<MediatorConfigRecord> {
    const { data, error } = await this.supabase.rpc('increment_mediator_count');
    if (!error && data) {
      return (Array.isArray(data) ? data[0] : data) as MediatorConfigRecord;
    }

    const current = await this.getMediatorConfig();
    return this.updateMediatorConfig({
      current_count: Math.min(current.max_count, current.current_count + 1),
    });
  }

  public async findOpenMediatorApplication(
    guildId: string,
    applicantId: string,
  ): Promise<MediatorApplicationRecord | null> {
    const { data, error } = await this.supabase
      .from('mediator_applications')
      .select('*')
      .eq('guild_id', guildId)
      .eq('applicant_id', applicantId)
      .eq('status', 'open')
      .maybeSingle();

    if (error) {
      this.handleDbError(error, `findOpenMediatorApplication (${applicantId})`);
      return null;
    }
    return data as MediatorApplicationRecord | null;
  }

  public async createMediatorApplication(input: {
    guildId: string;
    channelId: string;
    applicantId: string;
    applicantTag: string;
    verifiedAt: string | null;
  }): Promise<MediatorApplicationRecord> {
    const { data, error } = await this.supabase
      .from('mediator_applications')
      .insert({
        guild_id: input.guildId,
        channel_id: input.channelId,
        applicant_id: input.applicantId,
        applicant_tag: input.applicantTag,
        verified_at: input.verifiedAt,
      })
      .select('*')
      .single();

    if (error) {
      this.handleDbError(error, `createMediatorApplication (${input.applicantId})`);
      throw new Error('Failed to save mediator application');
    }
    return data as MediatorApplicationRecord;
  }

  public async setMediatorApplicationMessage(applicationId: string, messageId: string): Promise<void> {
    const { error } = await this.supabase
      .from('mediator_applications')
      .update({ message_id: messageId, updated_at: new Date().toISOString() })
      .eq('id', applicationId);

    if (error) {
      this.handleDbError(error, `setMediatorApplicationMessage (${applicationId})`);
    }
  }

  public async getMediatorApplicationByChannel(channelId: string): Promise<MediatorApplicationRecord | null> {
    const { data, error } = await this.supabase
      .from('mediator_applications')
      .select('*')
      .eq('channel_id', channelId)
      .maybeSingle();

    if (error) {
      this.handleDbError(error, `getMediatorApplicationByChannel (${channelId})`);
      return null;
    }
    return data as MediatorApplicationRecord | null;
  }

  public async updateMediatorApplication(
    applicationId: string,
    updates: Partial<Pick<
      MediatorApplicationRecord,
      'status' | 'decided_by' | 'decision_notes' | 'rejection_reason' | 'decided_at' | 'closed_at'
    >>,
  ): Promise<MediatorApplicationRecord> {
    const { data, error } = await this.supabase
      .from('mediator_applications')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', applicationId)
      .select('*')
      .single();

    if (error) {
      this.handleDbError(error, `updateMediatorApplication (${applicationId})`);
      throw new Error('Failed to update mediator application');
    }
    return data as MediatorApplicationRecord;
  }

  public async decideMediatorApplication(
    applicationId: string,
    updates: Pick<
      MediatorApplicationRecord,
      'status' | 'decided_by' | 'decision_notes' | 'rejection_reason' | 'decided_at'
    >,
  ): Promise<MediatorApplicationRecord | null> {
    const { data, error } = await this.supabase
      .from('mediator_applications')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', applicationId)
      .eq('status', 'open')
      .select('*')
      .maybeSingle();

    if (error) {
      this.handleDbError(error, `decideMediatorApplication (${applicationId})`);
      throw new Error('Failed to decide mediator application');
    }
    return data as MediatorApplicationRecord | null;
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
