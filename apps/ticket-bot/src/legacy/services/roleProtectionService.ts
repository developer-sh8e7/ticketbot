import {
  Events,
  PermissionsBitField,
  type Client,
  type Guild,
  type GuildMember,
  type PartialGuildMember,
  type Role,
} from 'discord.js';
import type { AppConfig } from '../types/config.js';
import { logger } from '../utils/logger.js';
import { RoleProtectionRepository } from '../database/roleProtectionRepository.js';

const ROLE_PROTECTION_GUILD_ALLOWLIST = new Set(['1413059459630104626', '1395842846107631746']);

export class RoleProtectionService {
  private interval: NodeJS.Timeout | null = null;
  private currentRoleId: string;
  private syncing = false;

  public constructor(
    private readonly client: Client,
    private readonly repository: RoleProtectionRepository,
    private readonly config: AppConfig,
  ) {
    this.currentRoleId = config.roleProtection.protectedRoleId;
  }

  public start(): void {
    if (!this.config.roleProtection.enabled) {
      logger.info('Role protection is disabled.');
      return;
    }

    if (!ROLE_PROTECTION_GUILD_ALLOWLIST.has(this.guildId)) {
      logger.warn(`Role protection is seed-guild only; disabled for guild ${this.guildId}.`);
      return;
    }

    this.client.on(Events.GuildMemberAdd, (member) => {
      void this.ensureMember(member, 'member-add');
    });

    this.client.on(Events.GuildMemberUpdate, (oldMember, newMember) => {
      void this.handleMemberUpdate(oldMember, newMember);
    });

    this.client.on(Events.GuildRoleDelete, (role) => {
      void this.handleRoleDelete(role);
    });

    void this.syncGuild('startup');

    this.interval = setInterval(
      () => void this.syncGuild('interval'),
      this.config.roleProtection.syncIntervalMinutes * 60 * 1000,
    );
  }

  public stop(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  private get guildId(): string {
    return this.config.guild.id;
  }

  private get sourceRoleId(): string {
    return this.config.roleProtection.protectedRoleId;
  }

  private get excludedRoleId(): string {
    return this.config.roleProtection.excludedRoleId;
  }

  private async fetchGuild(): Promise<Guild | null> {
    return this.client.guilds.fetch(this.guildId).catch(() => null);
  }

  private async resolveProtectedRole(guild: Guild): Promise<Role | null> {
    const state = await this.repository.findState(this.guildId, this.sourceRoleId).catch((error) => {
      logger.error('Failed to load protected role state', error instanceof Error ? error.message : error);
      return null;
    });

    this.currentRoleId = state?.current_role_id || this.currentRoleId || this.sourceRoleId;
    return guild.roles.fetch(this.currentRoleId).catch(() => null);
  }

  private async saveRoleState(role: Role): Promise<void> {
    await this.repository.upsertState({
      guild_id: this.guildId,
      source_role_id: this.sourceRoleId,
      current_role_id: role.id,
      role_name: role.name,
      role_color: role.color || null,
      role_hoist: role.hoist,
      role_mentionable: role.mentionable,
      role_permissions: role.permissions.bitfield.toString(),
      role_position: role.position,
    });
    this.currentRoleId = role.id;
  }

  private canManageRole(guild: Guild, role: Role): boolean {
    const me = guild.members.me;
    return Boolean(me?.permissions.has(PermissionsBitField.Flags.ManageRoles) && role.editable);
  }

  private async recreateProtectedRole(guild: Guild, deletedRole?: Role): Promise<Role | null> {
    const state = await this.repository.findState(this.guildId, this.sourceRoleId).catch(() => null);
    const created = await guild.roles.create({
      name: state?.role_name || deletedRole?.name || this.config.roleProtection.protectedRoleName,
      color: state?.role_color ?? deletedRole?.color ?? undefined,
      hoist: state?.role_hoist ?? deletedRole?.hoist ?? false,
      mentionable: state?.role_mentionable ?? deletedRole?.mentionable ?? false,
      permissions: state?.role_permissions ? BigInt(state.role_permissions) : deletedRole?.permissions.bitfield ?? 0n,
      reason: 'Protected role was deleted; recreating automatically.',
    }).catch((error) => {
      logger.error('Failed to recreate protected role', error instanceof Error ? error.message : error);
      return null;
    });

    if (!created) {
      return null;
    }

    const targetPosition = state?.role_position ?? deletedRole?.position;
    if (typeof targetPosition === 'number') {
      await created.setPosition(targetPosition, { reason: 'Restoring protected role position.' }).catch((error) => {
        logger.warn('Failed to restore protected role position', error instanceof Error ? error.message : error);
      });
    }

    await this.saveRoleState(created).catch((error) => {
      logger.error('Failed to save recreated protected role state', error instanceof Error ? error.message : error);
    });

    return created;
  }

  private shouldHaveProtectedRole(member: GuildMember): boolean {
    return !member.user.bot && !member.roles.cache.has(this.excludedRoleId);
  }

  private async ensureMember(member: GuildMember, reason: string): Promise<void> {
    if (member.guild.id !== this.guildId) return;

    const role = await this.resolveProtectedRole(member.guild);
    if (!role) return;

    if (member.roles.cache.has(this.excludedRoleId)) {
      if (member.roles.cache.has(role.id) && this.canManageRole(member.guild, role)) {
        await member.roles.remove(role, 'Excluded role blocks STB | Member.').catch(() => null);
      }
      await this.repository.removeMember(this.guildId, this.sourceRoleId, member.id).catch(() => null);
      return;
    }

    if (!member.roles.cache.has(role.id) && this.canManageRole(member.guild, role)) {
      await member.roles.add(role, `Auto-assign protected member role: ${reason}`).catch((error) => {
        logger.warn(`Failed to add protected role to ${member.id}`, error instanceof Error ? error.message : error);
      });
    }

    await this.repository.addMember(this.guildId, this.sourceRoleId, member.id).catch((error) => {
      logger.error('Failed to save protected role member', error instanceof Error ? error.message : error);
    });
  }

  private async handleMemberUpdate(oldMember: GuildMember | PartialGuildMember, newMember: GuildMember | PartialGuildMember): Promise<void> {
    if (newMember.guild.id !== this.guildId) return;

    const fullMember = newMember.partial ? await newMember.fetch().catch(() => null) : newMember;
    if (!fullMember) return;

    const hadExcluded = oldMember.roles.cache.has(this.excludedRoleId);
    const hasExcluded = fullMember.roles.cache.has(this.excludedRoleId);

    if (hadExcluded !== hasExcluded || !fullMember.roles.cache.has(this.currentRoleId)) {
      await this.ensureMember(fullMember, 'member-update');
    }
  }

  private async handleRoleDelete(role: Role): Promise<void> {
    if (role.guild.id !== this.guildId) return;
    if (role.id !== this.currentRoleId && role.id !== this.sourceRoleId) return;

    logger.warn(`Protected role deleted: ${role.name} (${role.id}). Recreating.`);
    const recreated = await this.recreateProtectedRole(role.guild, role);
    if (!recreated) return;

    await this.restoreSavedMembers(role.guild, recreated);
  }

  private async restoreSavedMembers(guild: Guild, role: Role): Promise<void> {
    const savedMemberIds = await this.repository.listMemberIds(this.guildId, this.sourceRoleId).catch((error) => {
      logger.error('Failed to load protected role member snapshot', error instanceof Error ? error.message : error);
      return [];
    });

    for (const memberId of savedMemberIds) {
      const member = await guild.members.fetch(memberId).catch(() => null);
      if (!member || !this.shouldHaveProtectedRole(member)) {
        await this.repository.removeMember(this.guildId, this.sourceRoleId, memberId).catch(() => null);
        continue;
      }

      if (!member.roles.cache.has(role.id) && this.canManageRole(guild, role)) {
        await member.roles.add(role, 'Restoring protected role after deletion.').catch((error) => {
          logger.warn(`Failed to restore protected role to ${memberId}`, error instanceof Error ? error.message : error);
        });
      }
    }
  }

  private async syncGuild(reason: string): Promise<void> {
    if (this.syncing) return;
    this.syncing = true;

    try {
      const guild = await this.fetchGuild();
      if (!guild) return;

      await guild.members.fetch();

      let role = await this.resolveProtectedRole(guild);
      if (!role) {
        role = await this.recreateProtectedRole(guild);
      }
      if (!role) return;

      await this.saveRoleState(role);

      const protectedMemberIds: string[] = [];
      for (const member of guild.members.cache.values()) {
        if (member.user.bot) continue;

        if (member.roles.cache.has(this.excludedRoleId)) {
          if (member.roles.cache.has(role.id) && this.canManageRole(guild, role)) {
            await member.roles.remove(role, 'Excluded role blocks STB | Member.').catch(() => null);
          }
          await this.repository.removeMember(this.guildId, this.sourceRoleId, member.id).catch(() => null);
          continue;
        }

        if (!member.roles.cache.has(role.id) && this.canManageRole(guild, role)) {
          await member.roles.add(role, `Protected role sync: ${reason}`).catch((error) => {
            logger.warn(`Failed to sync protected role to ${member.id}`, error instanceof Error ? error.message : error);
          });
        }

        protectedMemberIds.push(member.id);
      }

      await this.repository.replaceMembers(this.guildId, this.sourceRoleId, protectedMemberIds);
      logger.info(`Role protection sync complete (${reason}). Members saved: ${protectedMemberIds.length}`);
    } catch (error) {
      logger.error('Role protection sync failed', error instanceof Error ? error.stack ?? error.message : error);
    } finally {
      this.syncing = false;
    }
  }
}
