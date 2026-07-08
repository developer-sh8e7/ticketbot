import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  MessageFlags,
  PermissionsBitField,
  RoleSelectMenuBuilder,
  UserSelectMenuBuilder,
  type ButtonInteraction,
  type ChatInputCommandInteraction,
  type Guild,
  type GuildMember,
  type Message,
  type Role,
  type RoleSelectMenuInteraction,
  type UserSelectMenuInteraction,
} from 'discord.js';
import { RoleManagementRepository } from '../database/roleManagementRepository.js';
import type { AppConfig } from '../types/config.js';
import { hexToDecimal } from '../utils/color.js';
import { logger } from '../utils/logger.js';
import { isStbGuild } from '../constants/seedGuilds.js';

const ROLE_MANAGEMENT_OWNER_IDS = ['1397364822152315052', '959896496113844254'] as const;
const MM_PANEL_BUTTON_PREFIX = 'mmperm:btn:';
const MM_PANEL_SELECT_PREFIX = 'mmperm:select:';

type RoleAction = 'add' | 'remove';
type ReplyKind = 'ok' | 'deny' | 'limit';
type PermissionPanelInteraction = ChatInputCommandInteraction | ButtonInteraction;
type PermissionSelectInteraction = UserSelectMenuInteraction | RoleSelectMenuInteraction;

export class RoleManagementService {
  public constructor(
    private readonly repository: RoleManagementRepository,
    private readonly config: AppConfig,
  ) {}

  public isManagementOwner(userId: string): boolean {
    return ROLE_MANAGEMENT_OWNER_IDS.includes(userId as (typeof ROLE_MANAGEMENT_OWNER_IDS)[number]);
  }

  public async handleMessage(message: Message): Promise<boolean> {
    if (!this.config.roleManagement.enabled || !message.inGuild() || message.author.bot || !isStbGuild(message.guildId)) {
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

  public async sendPermissionPanel(interaction: PermissionPanelInteraction): Promise<void> {
    if (!interaction.inCachedGuild()) return;

    if (!isStbGuild(interaction.guildId)) {
      await this.replyInteraction(interaction, [this.buildDenyEmbed('❌ لوحة /mm مخصصة لسيرفر STB فقط.')]);
      return;
    }

    if (!this.isManagementOwner(interaction.user.id)) {
      await this.replyInteraction(interaction, [this.buildDenyEmbed('❌ هذا الأمر مخصص للمالكين المحددين فقط.')]);
      return;
    }

    const { embeds, components } = await this.buildPermissionPanel(interaction.guild, interaction.user.id);

    if (interaction.isButton()) {
      await interaction.update({ embeds, components }).catch(async () => {
        await interaction.reply({ embeds, components, flags: MessageFlags.Ephemeral }).catch(() => null);
      });
      return;
    }

    await interaction.reply({ embeds, components, flags: MessageFlags.Ephemeral }).catch(() => null);
  }

  public async handlePermissionButton(interaction: ButtonInteraction): Promise<void> {
    if (!interaction.inCachedGuild()) return;

    if (!isStbGuild(interaction.guildId)) {
      await interaction.reply({ embeds: [this.buildDenyEmbed('❌ لوحة /mm مخصصة لسيرفر STB فقط.')], flags: MessageFlags.Ephemeral }).catch(() => null);
      return;
    }

    if (!this.isManagementOwner(interaction.user.id)) {
      await interaction.reply({ embeds: [this.buildDenyEmbed('❌ ليس لديك صلاحية استخدام لوحة /mm.')], flags: MessageFlags.Ephemeral }).catch(() => null);
      return;
    }

    await interaction.deferUpdate().catch(() => null);
    const action = interaction.customId.slice(MM_PANEL_BUTTON_PREFIX.length);

    if (action === 'grant') {
      const embed = this.buildPanelEmbed('➕ إعطاء صلاحية', 'اختر شخص أو أكثر لإعطائهم صلاحية استخدام أوامر إعطاء/إزالة الرتب.');
      const row = new ActionRowBuilder<UserSelectMenuBuilder>().addComponents(
        new UserSelectMenuBuilder()
          .setCustomId(`${MM_PANEL_SELECT_PREFIX}grant_user`)
          .setPlaceholder('اختر الأشخاص لإعطائهم الصلاحية')
          .setMinValues(1)
          .setMaxValues(10),
      );
      await interaction.editReply({ embeds: [embed], components: [row] }).catch(() => null);
      return;
    }

    if (action === 'revoke') {
      const embed = this.buildPanelEmbed('➖ سحب صلاحية', 'اختر شخص أو أكثر لسحب صلاحية إدارة الرتب منهم.');
      const row = new ActionRowBuilder<UserSelectMenuBuilder>().addComponents(
        new UserSelectMenuBuilder()
          .setCustomId(`${MM_PANEL_SELECT_PREFIX}revoke_user`)
          .setPlaceholder('اختر الأشخاص لسحب الصلاحية منهم')
          .setMinValues(1)
          .setMaxValues(10),
      );
      await interaction.editReply({ embeds: [embed], components: [row] }).catch(() => null);
      return;
    }

    if (action === 'clear_users') {
      await this.repository.clearAuthorizedUsers(interaction.guild.id);
      await interaction.editReply({
        embeds: [this.buildPanelEmbed('✅ تم تصفير الصلاحيات', 'تم سحب الصلاحية من كل الأشخاص المضافين. يبقى فقط المالكون الثابتون.', true)],
        components: this.buildBackRow(),
      }).catch(() => null);
      return;
    }

    if (action === 'roles') {
      const allowedRoleIds = await this.getAllowedRoleIds(interaction.guild.id);
      const embed = this.buildPanelEmbed(
        '🎚️ تحديد الرتب المسموحة',
        'اختر الرتب التي تريد إضافتها للقائمة الحالية. الاختيار هنا يضيف ولا يمسح الرولات الموجودة.'
      );
      if (allowedRoleIds.length > 0) {
        embed.addFields({ name: 'الرولات الحالية', value: this.formatRoleList(allowedRoleIds), inline: false });
      }

      const row = new ActionRowBuilder<RoleSelectMenuBuilder>().addComponents(
        new RoleSelectMenuBuilder()
          .setCustomId(`${MM_PANEL_SELECT_PREFIX}add_roles`)
          .setPlaceholder('اختر الرولات لإضافتها للقائمة الحالية')
          .setMinValues(0)
          .setMaxValues(25),
      );
      await interaction.editReply({ embeds: [embed], components: [row] }).catch(() => null);
      return;
    }

    if (action === 'roles_remove') {
      const allowedRoleIds = await this.getAllowedRoleIds(interaction.guild.id);
      const embed = this.buildPanelEmbed('🧹 إزالة رولات من القائمة', 'اختر الرتب التي تريد إزالتها من القائمة الحالية.');
      if (allowedRoleIds.length > 0) {
        embed.addFields({ name: 'الرولات الحالية', value: this.formatRoleList(allowedRoleIds), inline: false });
      }

      const row = new ActionRowBuilder<RoleSelectMenuBuilder>().addComponents(
        new RoleSelectMenuBuilder()
          .setCustomId(`${MM_PANEL_SELECT_PREFIX}remove_roles`)
          .setPlaceholder('اختر الرولات لإزالتها من القائمة الحالية')
          .setMinValues(1)
          .setMaxValues(25),
      );
      await interaction.editReply({ embeds: [embed], components: [row] }).catch(() => null);
      return;
    }

    if (action === 'roles_reset') {
      await this.repository.setAllowedRoleIds(interaction.guild.id, this.config.roleManagement.allowedRoleIds, interaction.user.id);
      await interaction.editReply({
        embeds: [this.buildPanelEmbed('✅ تم استرجاع رولات config', `الرولات المسموحة الآن:\n${this.formatRoleList(this.config.roleManagement.allowedRoleIds)}`, true)],
        components: this.buildBackRow(),
      }).catch(() => null);
      return;
    }

    if (action === 'list') {
      await this.showPermissionList(interaction);
      return;
    }

    if (action === 'refresh' || action === 'back') {
      const { embeds, components } = await this.buildPermissionPanel(interaction.guild, interaction.user.id);
      await interaction.editReply({ embeds, components }).catch(() => null);
      return;
    }
  }

  public async handlePermissionSelect(interaction: PermissionSelectInteraction): Promise<void> {
    if (!interaction.inCachedGuild()) return;

    if (!isStbGuild(interaction.guildId)) {
      await interaction.reply({ embeds: [this.buildDenyEmbed('❌ لوحة /mm مخصصة لسيرفر STB فقط.')], flags: MessageFlags.Ephemeral }).catch(() => null);
      return;
    }

    if (!this.isManagementOwner(interaction.user.id)) {
      await interaction.reply({ embeds: [this.buildDenyEmbed('❌ ليس لديك صلاحية استخدام لوحة /mm.')], flags: MessageFlags.Ephemeral }).catch(() => null);
      return;
    }

    await interaction.deferUpdate().catch(() => null);
    const action = interaction.customId.slice(MM_PANEL_SELECT_PREFIX.length);

    try {
      if (action === 'grant_user') {
        for (const userId of interaction.values) {
          if (this.isManagementOwner(userId)) continue;
          await this.repository.authorizeUser(interaction.guild.id, userId, interaction.user.id);
        }

        const embed = this.buildPanelEmbed(
          '✅ تم إعطاء الصلاحية',
          interaction.values.map((userId) => `• <@${userId}>`).join('\n') || 'لم يتم تحديد أي شخص.',
          true,
        );
        const components = this.buildBackRow();
        await interaction.editReply({ embeds: [embed], components }).catch(() => null);
        return;
      }

      if (action === 'revoke_user') {
        for (const userId of interaction.values) {
          if (this.isManagementOwner(userId)) continue;
          await this.repository.revokeUser(interaction.guild.id, userId);
        }

        const embed = this.buildPanelEmbed(
          '✅ تم سحب الصلاحية',
          interaction.values.map((userId) => `• <@${userId}>`).join('\n') || 'لم يتم تحديد أي شخص.',
          true,
        );
        const components = this.buildBackRow();
        await interaction.editReply({ embeds: [embed], components }).catch(() => null);
        return;
      }

      if (action === 'add_roles') {
        const currentRoleIds = await this.getAllowedRoleIds(interaction.guild.id);
        const nextRoleIds = [...new Set([...currentRoleIds, ...interaction.values])];
        await this.repository.setAllowedRoleIds(interaction.guild.id, nextRoleIds, interaction.user.id);
        const embed = this.buildPanelEmbed(
          '✅ تم إضافة الرولات',
          `الرولات المسموحة الآن (${nextRoleIds.length}):\n${this.formatRoleList(nextRoleIds)}`,
          true,
        );
        const components = this.buildBackRow();
        await interaction.editReply({ embeds: [embed], components }).catch(() => null);
        return;
      }

      if (action === 'remove_roles') {
        const removeSet = new Set(interaction.values);
        const currentRoleIds = await this.getAllowedRoleIds(interaction.guild.id);
        const nextRoleIds = currentRoleIds.filter((roleId) => !removeSet.has(roleId));
        await this.repository.setAllowedRoleIds(interaction.guild.id, nextRoleIds, interaction.user.id);
        const embed = this.buildPanelEmbed(
          '✅ تم إزالة الرولات المحددة',
          nextRoleIds.length === 0
            ? 'القائمة أصبحت فارغة. اضغط "استرجاع config" إذا تبي ترجع الرولات الافتراضية.'
            : `الرولات المسموحة الآن (${nextRoleIds.length}):\n${this.formatRoleList(nextRoleIds)}`,
          true,
        );
        const components = this.buildBackRow();
        await interaction.editReply({ embeds: [embed], components }).catch(() => null);
        return;
      }
    } catch (error) {
      logger.error('Role management panel action failed', error instanceof Error ? error.message : error);
      await interaction.editReply({
        embeds: [this.buildDenyEmbed('صار خطأ أثناء حفظ التغيير. تأكد أن جدول role_management_allowed_roles موجود في Supabase.')],
        components: this.buildBackRow(),
      }).catch(() => null);
    }
  }

  public isPermissionPanelButton(customId: string): boolean {
    return customId.startsWith(MM_PANEL_BUTTON_PREFIX);
  }

  public isPermissionPanelSelect(customId: string): boolean {
    return customId.startsWith(MM_PANEL_SELECT_PREFIX);
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
    return this.isManagementOwner(userId);
  }

  private async canUseRoleCommands(guildId: string, userId: string): Promise<boolean> {
    if (this.isOwner(userId)) return true;
    return this.repository.isAuthorized(guildId, userId);
  }

  private async getAllowedRoleIds(guildId: string): Promise<string[]> {
    const dbRoleIds = await this.repository.listAllowedRoleIds(guildId).catch((error) => {
      logger.warn('Failed to load role management allowed roles; falling back to config.', error instanceof Error ? error.message : error);
      return [];
    });

    return [...new Set([...this.config.roleManagement.allowedRoleIds, ...dbRoleIds])];
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

    if (!this.isManagementOwner(message.author.id)) {
      await this.reply(message, 'deny', 'ما عندك صلاحية. استخدم لوحة `/mm` من حساب المالك فقط.');
      return;
    }

    const targetUser = message.mentions.users.first();
    if (!targetUser) {
      await this.reply(message, 'limit', 'اكتبها كذا: `صلاحية @الشخص` أو استخدم `/mm` للوحة التحكم.');
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

    if (this.config.roleManagement.blockedRoleIds.includes(role.id)) {
      await this.reply(message, 'deny', 'هذه الرتبة غير مسموح إدارتها من هذا النظام.');
      return;
    }

    const allowedRoleIds = await this.getAllowedRoleIds(message.guild.id);
    if (!allowedRoleIds.includes(role.id)) {
      await this.reply(message, 'deny', 'هذه الرتبة غير موجودة ضمن الرتب المسموحة في لوحة `/mm`.');
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

  private async buildPermissionPanel(guild: Guild, actorId: string): Promise<{ embeds: EmbedBuilder[]; components: any[] }> {
    const authorizedUsers = await this.repository.listAuthorizedUsers(guild.id).catch((error) => {
      logger.warn('Failed to load role management authorized users.', error instanceof Error ? error.message : error);
      return [];
    });
    const allowedRoleIds = await this.getAllowedRoleIds(guild.id);

    const embed = new EmbedBuilder()
      .setColor(hexToDecimal(this.config.bot.embedColor))
      .setTitle('🛡️ لوحة /mm لإدارة صلاحيات الرتب')
      .setDescription(
        'من هنا تتحكم بمن يستطيع استخدام أوامر `اعطاء @شخص @رتبة` و `ازالة @شخص @رتبة`، وتحدد الرتب المسموحة لهم.',
      )
      .addFields(
        { name: '👑 مالكين اللوحة', value: ROLE_MANAGEMENT_OWNER_IDS.map((id) => `<@${id}>`).join('\n'), inline: true },
        { name: '👥 أصحاب الصلاحية', value: `${authorizedUsers.length} شخص`, inline: true },
        { name: '🎚️ الرتب المسموحة', value: allowedRoleIds.length ? this.formatRoleList(allowedRoleIds) : 'لا توجد رتب محددة.', inline: false },
      )
      .setFooter({ text: `Requested by ${actorId}` })
      .setTimestamp();

    const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId('mmperm:btn:grant').setLabel('إعطاء صلاحية').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('mmperm:btn:revoke').setLabel('سحب صلاحية').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId('mmperm:btn:clear_users').setLabel('سحب الكل').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId('mmperm:btn:list').setLabel('عرض الصلاحيات').setStyle(ButtonStyle.Secondary),
    );

    const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId('mmperm:btn:roles').setLabel('إضافة رولات').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('mmperm:btn:roles_remove').setLabel('إزالة رولات').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('mmperm:btn:roles_reset').setLabel('استرجاع config').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('mmperm:btn:refresh').setLabel('تحديث اللوحة').setStyle(ButtonStyle.Secondary),
    );

    return { embeds: [embed], components: [row1, row2] };
  }

  private async showPermissionList(interaction: ButtonInteraction): Promise<void> {
    const authorizedUsers = await this.repository.listAuthorizedUsers(interaction.guild!.id);
    const allowedRoleIds = await this.getAllowedRoleIds(interaction.guild!.id);

    const userLines = authorizedUsers.length === 0
      ? ['لا يوجد أشخاص مضافين حالياً.']
      : authorizedUsers.map((row, index) => `${index + 1}. <@${row.user_id}> — بواسطة <@${row.granted_by}>`);

    const embed = this.buildPanelEmbed('📋 قائمة صلاحيات /mm', 'كل الأشخاص والرولات المسموحة حالياً.')
      .addFields(
        { name: '👑 المالكون الثابتون', value: ROLE_MANAGEMENT_OWNER_IDS.map((id) => `<@${id}>`).join('\n'), inline: false },
        { name: '👥 الأشخاص المضافين', value: this.trimEmbedValue(userLines.join('\n')), inline: false },
        { name: '🎚️ الرولات المسموحة', value: allowedRoleIds.length ? this.formatRoleList(allowedRoleIds) : 'لا توجد رتب محددة.', inline: false },
      );

    await interaction.editReply({ embeds: [embed], components: this.buildBackRow() }).catch(() => null);
  }

  private buildBackRow(): any[] {
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId('mmperm:btn:back').setLabel('↩️ رجوع للوحة').setStyle(ButtonStyle.Secondary),
    );
    return [row];
  }

  private buildPanelEmbed(title: string, description: string, success = false): EmbedBuilder {
    return new EmbedBuilder()
      .setColor(hexToDecimal(success ? this.config.bot.successColor : this.config.bot.embedColor))
      .setTitle(title)
      .setDescription(description)
      .setTimestamp();
  }

  private buildDenyEmbed(description: string): EmbedBuilder {
    return new EmbedBuilder()
      .setColor(hexToDecimal(this.config.bot.errorColor))
      .setTitle('خطأ في الصلاحيات')
      .setDescription(description)
      .setTimestamp();
  }

  private async replyInteraction(interaction: PermissionPanelInteraction, embeds: EmbedBuilder[], components?: any[]): Promise<void> {
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply({ embeds, components }).catch(() => null);
      return;
    }

    await interaction.reply({ embeds, components, flags: MessageFlags.Ephemeral }).catch(() => null);
  }

  private formatRoleList(roleIds: readonly string[]): string {
    return this.trimEmbedValue(roleIds.map((roleId) => `• <@&${roleId}>`).join('\n'));
  }

  private trimEmbedValue(value: string): string {
    return value.length > 1000 ? `${value.slice(0, 997)}...` : value;
  }
}
