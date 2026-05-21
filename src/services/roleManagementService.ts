import { PermissionsBitField, type Guild, type GuildMember, type Message, type Role } from 'discord.js';
import { RoleManagementRepository } from '../database/roleManagementRepository.js';
import type { AppConfig } from '../types/config.js';
import { logger } from '../utils/logger.js';

type RoleAction = 'add' | 'remove';
type ReplyKind = 'ok' | 'deny' | 'limit';

export class RoleManagementService {
  public constructor(
    private readonly repository: RoleManagementRepository,
    private readonly config: AppConfig,
  ) {}

  public async handleMessage(message: Message): Promise<boolean> {
    if (!this.config.roleManagement.enabled || !message.inGuild() || message.author.bot) {
      return false;
    }

    const content = message.content.trim().replace(/\s+/g, ' ');
    if (!content) return false;

    const command = content.split(' ')[0]?.trim();
    if (command === 'صلاحية' || command === 'صلاحيات') {
      await this.handleAuthorize(message);
      return true;
    }

    const action = this.parseAction(command);
    if (!action) {
      return false;
    }

    await this.handleRoleAction(message, action);
    return true;
  }

  private parseAction(command: string | undefined): RoleAction | null {
    if (command === 'اعطاء' || command === 'إعطاء') return 'add';
    if (command === 'ازالة' || command === 'ازاله' || command === 'إزالة' || command === 'إزاله') return 'remove';
    return null;
  }

  private icon(guild: Guild | null, kind: ReplyKind): string {
    const emojiName = kind === 'ok' ? 'stb_role_allow' : kind === 'limit' ? 'stb_role_limit' : 'stb_role_deny';
    return guild?.emojis.cache.find((emoji) => emoji.name === emojiName)?.toString() ?? '';
  }

  private isOwner(userId: string): boolean {
    return userId === this.config.roleManagement.ownerId;
  }

  private async canUseRoleCommands(guildId: string, userId: string): Promise<boolean> {
    if (this.isOwner(userId)) return true;
    return this.repository.isAuthorized(guildId, userId);
  }

  private getTodayKey(): string {
    return new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString().slice(0, 10);
  }

  private async reply(message: Message, kind: ReplyKind, text: string): Promise<void> {
    const icon = this.icon(message.guild, kind);
    const content = icon ? `${icon} ${text}` : text;
    await message.reply({
      content,
      allowedMentions: {
        repliedUser: true,
        users: [],
        roles: [],
      },
    }).catch(() => null);
  }

  private async handleAuthorize(message: Message): Promise<void> {
    if (!message.guild) return;

    if (!this.isOwner(message.author.id)) {
      await this.reply(message, 'deny', 'ما عندك صلاحية.');
      return;
    }

    const targetUser = message.mentions.users.first();
    if (!targetUser) {
      await this.reply(message, 'limit', 'اكتبها كذا: `صلاحية @الشخص`');
      return;
    }

    try {
      await this.repository.authorizeUser(message.guild.id, targetUser.id, message.author.id);
      await this.reply(message, 'ok', `تم إعطاء صلاحية إدارة الرتب لـ <@${targetUser.id}>.`);
    } catch (error) {
      logger.error('Failed to authorize role manager', error instanceof Error ? error.message : error);
      await this.reply(message, 'deny', 'ما قدرت أحفظ الصلاحية. تأكد أن جداول Supabase مضافة.');
    }
  }

  private async handleRoleAction(message: Message, action: RoleAction): Promise<void> {
    if (!message.guild) return;

    const authorized = await this.canUseRoleCommands(message.guild.id, message.author.id).catch((error) => {
      logger.error('Failed to check role management authorization', error instanceof Error ? error.message : error);
      return false;
    });

    if (!authorized) {
      await this.reply(message, 'deny', 'ما عندك صلاحيات كافية.');
      return;
    }

    const targetUser = message.mentions.users.first();
    const role = message.mentions.roles.first();

    if (!targetUser || !role) {
      const command = action === 'add' ? 'اعطاء' : 'ازالة';
      await this.reply(message, 'limit', `اكتبها كذا: \`${command} @الشخص @الرتبة\``);
      return;
    }

    if (!this.config.roleManagement.allowedRoleIds.includes(role.id)) {
      await this.reply(message, 'deny', 'هذه الرتبة غير مسموح إدارتها من هذا النظام.');
      return;
    }

    const targetMember = await message.guild.members.fetch(targetUser.id).catch(() => null);
    if (!targetMember) {
      await this.reply(message, 'deny', 'ما قدرت ألقى هذا الشخص داخل السيرفر.');
      return;
    }

    if (!this.canManageRole(message.member, role)) {
      await this.reply(message, 'deny', 'البوت ما يقدر يعدل هذه الرتبة. ارفع رتبة البوت فوقها وتأكد من صلاحية Manage Roles.');
      return;
    }

    try {
      if (action === 'add') {
        await this.addRole(message, targetMember, role);
        return;
      }

      await this.removeRole(message, targetMember, role);
    } catch (error) {
      logger.error('Role management command failed', error instanceof Error ? error.message : error);
      await this.reply(message, 'deny', 'صار خطأ أثناء تعديل الرتبة.');
    }
  }

  private canManageRole(actor: GuildMember | null, role: Role): boolean {
    const me = role.guild.members.me;
    return Boolean(
      actor &&
      me?.permissions.has(PermissionsBitField.Flags.ManageRoles) &&
      role.editable,
    );
  }

  private async addRole(message: Message, targetMember: GuildMember, role: Role): Promise<void> {
    if (targetMember.roles.cache.has(role.id)) {
      await this.reply(message, 'limit', `<@${targetMember.id}> عنده الرتبة بالفعل.`);
      return;
    }

    const limitedRoleId = this.config.roleManagement.dailyLimitedRoleId;
    if (role.id === limitedRoleId && !this.isOwner(message.author.id)) {
      const dayKey = this.getTodayKey();
      const used = await this.repository.getDailyCount(message.guild!.id, message.author.id, role.id, dayKey);
      if (used >= this.config.roleManagement.dailyLimitedRoleLimit) {
        await this.reply(message, 'limit', `وصلت الحد اليومي لهذه الرتبة: ${this.config.roleManagement.dailyLimitedRoleLimit} أشخاص.`);
        return;
      }

      await targetMember.roles.add(role, `Role management command by ${message.author.tag}`);
      await this.repository.setDailyCount(message.guild!.id, message.author.id, role.id, dayKey, used + 1);
      await this.reply(message, 'ok', `تم إعطاء رتبة <@&${role.id}> لـ <@${targetMember.id}>. المتبقي اليوم: ${this.config.roleManagement.dailyLimitedRoleLimit - used - 1}`);
      return;
    }

    await targetMember.roles.add(role, `Role management command by ${message.author.tag}`);
    await this.reply(message, 'ok', `تم إعطاء رتبة <@&${role.id}> لـ <@${targetMember.id}>.`);
  }

  private async removeRole(message: Message, targetMember: GuildMember, role: Role): Promise<void> {
    if (!targetMember.roles.cache.has(role.id)) {
      await this.reply(message, 'limit', `<@${targetMember.id}> ما عنده هذه الرتبة.`);
      return;
    }

    await targetMember.roles.remove(role, `Role management command by ${message.author.tag}`);
    await this.reply(message, 'ok', `تمت إزالة رتبة <@&${role.id}> من <@${targetMember.id}>.`);
  }
}
