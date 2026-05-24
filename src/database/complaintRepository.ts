import type { SupabaseClient } from '@supabase/supabase-js';
import { logger } from '../utils/logger.js';

export interface ComplaintRecord {
  complaint_id: number;
  user_id: string;
  mediator_id: string | null;
  ticket_id: string | null;
  trade_value: string | null;
  mediator_type: string | null;
  complaint_type: 'mediator' | 'general';
  category: string | null;
  description: string;
  evidence: {
    name: string;
    original_url: string;
    permanent_url: string;
    size: number;
    contentType: string | null;
  }[];
  status: 'open' | 'reviewing' | 'solved';
  created_at: string;
  handled_by: string | null;
  channel_id: string | null;
  resolution_notes: string | null;
  is_synced?: boolean;
}

// In-memory fallback storage
const inMemoryComplaints = new Map<number, ComplaintRecord>();

export class ComplaintRepository {
  public constructor(private readonly supabase: SupabaseClient) {
    // Start periodic sync check every 1 minute to ensure eventual database consistency
    setInterval(() => {
      this.syncWithDatabase().catch((err) => {
        logger.error('[ComplaintRepository] Error in periodic syncWithDatabase:', err);
      });
    }, 60 * 1000).unref();
  }

  public get client(): SupabaseClient {
    return this.supabase;
  }

  private handleDbError(error: any, context: string): void {
    if (error.code === '42P01') {
      logger.warn(`[ComplaintRepository] Table missing during "${context}". Falling back to in-memory storage. Please run 'supabase/complaints.sql' in your Supabase SQL Editor. Details: ${error.message}`);
    } else {
      logger.error(`[ComplaintRepository] Database error during "${context}": ${error.message}`);
    }
  }

  /**
   * Attempts to synchronize unsynced in-memory complaints to the database.
   * Triggered automatically during successful database requests.
   */
  public async syncWithDatabase(): Promise<void> {
    const unsynced = Array.from(inMemoryComplaints.values()).filter(c => !c.is_synced);
    if (unsynced.length === 0) return;

    logger.info(`[ComplaintRepository] Attempting to sync ${unsynced.length} unsynced complaints to database...`);
    
    for (const record of unsynced) {
      try {
        const { complaint_id, is_synced, ...dbInput } = record;
        const { data, error } = await this.supabase
          .from('complaints')
          .insert(dbInput)
          .select('complaint_id')
          .single();

        if (!error && data) {
          // Remove old in-memory record under temporary ID and save new one
          inMemoryComplaints.delete(complaint_id);
          const syncedRecord: ComplaintRecord = {
            ...record,
            complaint_id: data.complaint_id,
            is_synced: true
          };
          inMemoryComplaints.set(data.complaint_id, syncedRecord);
          logger.info(`[ComplaintRepository] Successfully synced complaint temporary ID: ${complaint_id} to official DB ID: ${data.complaint_id}`);
        } else if (error) {
          logger.warn(`[ComplaintRepository] Sync failed for temp ID: ${complaint_id} - ${error.message}`);
          break; // Stop syncing if DB is still showing errors
        }
      } catch (err: any) {
        logger.error(`[ComplaintRepository] Sync exception for temp ID: ${record.complaint_id}`, err);
        break;
      }
    }
  }

  public async createComplaint(input: {
    user_id: string;
    mediator_id: string | null;
    ticket_id: string | null;
    trade_value: string | null;
    mediator_type: string | null;
    complaint_type: 'mediator' | 'general';
    category: string | null;
    description: string;
    evidence?: ComplaintRecord['evidence'];
    channel_id: string | null;
  }): Promise<ComplaintRecord> {
    const recordInput = {
      user_id: input.user_id,
      mediator_id: input.mediator_id || null,
      ticket_id: input.ticket_id || null,
      trade_value: input.trade_value || null,
      mediator_type: input.mediator_type || null,
      complaint_type: input.complaint_type,
      category: input.category || null,
      description: input.description,
      evidence: input.evidence || [],
      status: 'open' as const,
      created_at: new Date().toISOString(),
      handled_by: null,
      channel_id: input.channel_id || null,
      resolution_notes: null
    };

    try {
      // First try executing sync in case DB is back online
      await this.syncWithDatabase().catch(() => null);

      const { data, error } = await this.supabase
        .from('complaints')
        .insert(recordInput)
        .select('*')
        .single();

      if (error) {
        this.handleDbError(error, 'createComplaint');
        
        // Generate temporary serial ID for in-memory
        const maxId = Array.from(inMemoryComplaints.keys()).reduce((max, id) => Math.max(max, id), 0);
        const tempId = maxId > 0 ? maxId + 1 : 1;
        
        const inMemoryRecord: ComplaintRecord = {
          complaint_id: tempId,
          ...recordInput,
          is_synced: false
        };
        inMemoryComplaints.set(tempId, inMemoryRecord);
        return inMemoryRecord;
      }

      const syncedRecord: ComplaintRecord = {
        ...(data as ComplaintRecord),
        is_synced: true
      };
      inMemoryComplaints.set(syncedRecord.complaint_id, syncedRecord);
      return syncedRecord;
    } catch (err) {
      logger.error(`[ComplaintRepository] Exception in createComplaint:`, err);
      
      const maxId = Array.from(inMemoryComplaints.keys()).reduce((max, id) => Math.max(max, id), 0);
      const tempId = maxId > 0 ? maxId + 1 : 1;
      
      const inMemoryRecord: ComplaintRecord = {
        complaint_id: tempId,
        ...recordInput,
        is_synced: false
      };
      inMemoryComplaints.set(tempId, inMemoryRecord);
      return inMemoryRecord;
    }
  }

  public async getComplaint(complaintId: number): Promise<ComplaintRecord | null> {
    try {
      await this.syncWithDatabase().catch(() => null);

      const { data, error } = await this.supabase
        .from('complaints')
        .select('*')
        .eq('complaint_id', complaintId)
        .maybeSingle();

      if (error) {
        this.handleDbError(error, `getComplaint (${complaintId})`);
        return inMemoryComplaints.get(complaintId) || null;
      }

      if (data) {
        const synced = { ...(data as ComplaintRecord), is_synced: true };
        inMemoryComplaints.set(complaintId, synced);
        return synced;
      }

      return inMemoryComplaints.get(complaintId) || null;
    } catch (err) {
      logger.error(`[ComplaintRepository] Exception in getComplaint:`, err);
      return inMemoryComplaints.get(complaintId) || null;
    }
  }

  public async getComplaintByChannelId(channelId: string): Promise<ComplaintRecord | null> {
    try {
      await this.syncWithDatabase().catch(() => null);

      const { data, error } = await this.supabase
        .from('complaints')
        .select('*')
        .eq('channel_id', channelId)
        .maybeSingle();

      if (error) {
        this.handleDbError(error, `getComplaintByChannelId (${channelId})`);
        return Array.from(inMemoryComplaints.values()).find(c => c.channel_id === channelId) || null;
      }

      if (data) {
        const synced = { ...(data as ComplaintRecord), is_synced: true };
        inMemoryComplaints.set(synced.complaint_id, synced);
        return synced;
      }

      return Array.from(inMemoryComplaints.values()).find(c => c.channel_id === channelId) || null;
    } catch (err) {
      logger.error(`[ComplaintRepository] Exception in getComplaintByChannelId:`, err);
      return Array.from(inMemoryComplaints.values()).find(c => c.channel_id === channelId) || null;
    }
  }

  public async updateComplaint(complaintId: number, updates: Partial<ComplaintRecord>): Promise<ComplaintRecord> {
    try {
      await this.syncWithDatabase().catch(() => null);

      const { data, error } = await this.supabase
        .from('complaints')
        .update(updates)
        .eq('complaint_id', complaintId)
        .select('*')
        .single();

      if (error) {
        this.handleDbError(error, `updateComplaint (${complaintId})`);
        const existing = inMemoryComplaints.get(complaintId);
        if (!existing) throw new Error(`Complaint with ID ${complaintId} not found in cache.`);

        const merged: ComplaintRecord = {
          ...existing,
          ...updates,
          is_synced: false // Mark unsynced since update failed in DB
        };
        inMemoryComplaints.set(complaintId, merged);
        return merged;
      }

      const synced = { ...(data as ComplaintRecord), is_synced: true };
      inMemoryComplaints.set(complaintId, synced);
      return synced;
    } catch (err: any) {
      logger.error(`[ComplaintRepository] Exception in updateComplaint:`, err);
      const existing = inMemoryComplaints.get(complaintId);
      if (!existing) throw new Error(`Complaint with ID ${complaintId} not found in cache.`);

      const merged: ComplaintRecord = {
        ...existing,
        ...updates,
        is_synced: false
      };
      inMemoryComplaints.set(complaintId, merged);
      return merged;
    }
  }

  public async listComplaints(): Promise<ComplaintRecord[]> {
    try {
      await this.syncWithDatabase().catch(() => null);

      const { data, error } = await this.supabase
        .from('complaints')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        this.handleDbError(error, 'listComplaints');
        return Array.from(inMemoryComplaints.values()).sort((a, b) => b.complaint_id - a.complaint_id);
      }

      // Sync cache
      for (const row of data || []) {
        inMemoryComplaints.set(row.complaint_id, { ...(row as ComplaintRecord), is_synced: true });
      }

      // Combine database records with any remaining unsynced cached records
      const dbRows = (data || []) as ComplaintRecord[];
      const unsyncedRows = Array.from(inMemoryComplaints.values()).filter(c => !c.is_synced);
      return [...dbRows, ...unsyncedRows].sort((a, b) => {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
    } catch (err) {
      logger.error(`[ComplaintRepository] Exception in listComplaints:`, err);
      return Array.from(inMemoryComplaints.values()).sort((a, b) => b.complaint_id - a.complaint_id);
    }
  }

  public async getMediatorComplaints(mediatorId: string): Promise<ComplaintRecord[]> {
    const list = await this.listComplaints();
    return list.filter(c => c.mediator_id === mediatorId);
  }

  public async getMediatorComplaintsCount(mediatorId: string): Promise<number> {
    const list = await this.getMediatorComplaints(mediatorId);
    return list.length;
  }

  public async getOpenComplaintsCount(): Promise<number> {
    const list = await this.listComplaints();
    return list.filter(c => c.status === 'open' || c.status === 'reviewing').length;
  }

  public async checkActiveComplaintExistsForTicket(ticketId: string, alternateTicketId?: string): Promise<boolean> {
    const list = await this.listComplaints();
    return list.some(c => {
      if (c.status === 'solved') return false;
      return c.ticket_id === ticketId || (alternateTicketId && c.ticket_id === alternateTicketId);
    });
  }

  public async checkActiveComplaintExistsForUser(userId: string): Promise<boolean> {
    const list = await this.listComplaints();
    return list.some(c => c.user_id === userId && c.status !== 'solved');
  }

  public async checkUserRateLimit(userId: string, minutes = 5): Promise<boolean> {
    const list = await this.listComplaints();
    const userComplaints = list.filter(c => c.user_id === userId);
    if (userComplaints.length === 0) return false;

    const lastOne = userComplaints.reduce((latest, current) => {
      const latestTime = new Date(latest.created_at).getTime();
      const currentTime = new Date(current.created_at).getTime();
      return currentTime > latestTime ? current : latest;
    });

    const elapsed = Date.now() - new Date(lastOne.created_at).getTime();
    return elapsed < minutes * 60 * 1000;
  }
}
