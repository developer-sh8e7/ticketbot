import type { Client } from 'discord.js';
import { InstanceLockRepository } from '../database/instanceLockRepository.js';
import { logger } from '../utils/logger.js';

export const INSTANCE_LOCK_TTL_MS = 90_000;
const HEARTBEAT_MS = 30_000;

export class InstanceGuardService {
  private heartbeat: NodeJS.Timeout | null = null;

  public constructor(
    private readonly client: Client,
    private readonly repository: InstanceLockRepository,
    private readonly guildId: string,
    private readonly instanceId: string,
  ) {}

  public async start(): Promise<boolean> {
    const current = await this.repository.find(this.guildId);
    const currentUpdatedAt = current ? new Date(current.updated_at).getTime() : 0;
    const currentFresh = current ? Date.now() - currentUpdatedAt < INSTANCE_LOCK_TTL_MS : false;

    if (current && current.instance_id !== this.instanceId && currentFresh) {
      logger.warn(`Another active bot instance owns the lock: ${current.instance_id}. ${this.instanceId} will stay offline.`);
      this.client.destroy();
      return false;
    }

    await this.repository.upsert(this.guildId, this.instanceId);
    this.heartbeat = setInterval(() => void this.beat(), HEARTBEAT_MS);
    logger.info(`Instance lock acquired for guild ${this.guildId} by ${this.instanceId}.`);
    return true;
  }

  public async stop(): Promise<void> {
    if (this.heartbeat) {
      clearInterval(this.heartbeat);
      this.heartbeat = null;
    }

    await this.repository.release(this.guildId, this.instanceId).catch((error) => {
      logger.warn('Failed to release instance lock', error instanceof Error ? error.message : error);
    });
  }

  private async beat(): Promise<void> {
    try {
      const current = await this.repository.find(this.guildId);
      const currentUpdatedAt = current ? new Date(current.updated_at).getTime() : 0;
      const currentFresh = current ? Date.now() - currentUpdatedAt < INSTANCE_LOCK_TTL_MS : false;

      if (current && current.instance_id !== this.instanceId && currentFresh) {
        logger.error(`Instance lock stolen by ${current.instance_id}. Disconnecting duplicate ${this.instanceId}.`);
        if (this.heartbeat) {
          clearInterval(this.heartbeat);
          this.heartbeat = null;
        }
        this.client.destroy();
        return;
      }

      await this.repository.upsert(this.guildId, this.instanceId);
    } catch (error) {
      logger.warn('Instance lock heartbeat failed', error instanceof Error ? error.message : error);
    }
  }
}
