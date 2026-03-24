import {
  AttachmentBuilder,
  ChannelType,
  EmbedBuilder,
  PermissionFlagsBits,
  type ButtonInteraction,
  type Guild,
  type GuildMember,
  type GuildTextBasedChannel,
  type ModalSubmitInteraction,
  type Snowflake,
  type StringSelectMenuInteraction,
  type TextChannel,
} from 'discord.js';
import { buildAddMemberModal, buildOpenTicketModal, buildRemoveMemberModal } from '../builders/modalBuilder.js';
import {
  buildAlreadyOpenEmbed,
  buildErrorEmbed,
  buildSuccessEmbed,
  buildTicketActionRows,
  buildTicketEmbeds,
} from '../builders/ticketBuilder.js';
import {
  ADD_MEMBER_MODAL_ID,
  MEMBER_MODAL_FIELD_ID,
  REMOVE_MEMBER_MODAL_ID,
  TICKET_BUTTON_IDS,
  extractOpenTicketCategoryKey,
} from '../constants/customIds.js';
import { DuplicateOpenTicketError, TicketRepository } from '../database/ticketRepository.js';
import type { TicketRecord } from '../database/types.js';
import type { AppConfig, TicketAnswer, TicketCategoryConfig } from '../types/config.js';
import { isGuildTextChannelType } from '../utils/discord.js';
import { logger } from '../utils/logger.js';
import {
  formatRoleMentions,
  normalizeChannelName,
  normalizeSnowflake,
  padTicketNumber,
  replaceTokens,
  truncateText,
  uniqueStrings,
} from '../utils/text.js';
import { canManageTicket } from './permissionService.js';
import { ConfigStore } from './configStore.js';
import { TranscriptService } from './transcriptService.js';

interface TicketServiceDependencies {
  configStore: ConfigStore;
  ticketRepository: TicketRepository;
  transcriptService: TranscriptService;
}

interface ResolvedTicketContext {
  config: AppConfig;
  ticket: TicketRecord;
  guild: Guild;
  member: GuildMember;
  channel: TextChannel;
}

export class TicketService {
  private readonly configStore: ConfigStore;
  private readonly ticketRepository: TicketRepository;
  private readonly transcriptService: TranscriptService;

  public constructor(dependencies: TicketServiceDependencies) {
    this.configStore = dependencies.configStore;
    this.ticketRepository = dependencies.ticketRepository;
    this.transcriptService = dependencies.transcriptService;
  }

  private get config(): AppConfig {
    return this.configStore.current;
  }

  private getEnabledCategory(categoryKey: string): TicketCategoryConfig | undefined {
    return this.config.categories.find((category) => category.enabled && category.key === categoryKey);
  }

  private buildAnswers(
    interaction: ModalSubmitInteraction,
    category: TicketCategoryConfig,
  ): TicketAnswer[] {
    return category.questions.map((question) => ({
      key: question.key,
      label: question.label,
      value: interaction.fields.getTextInputValue(question.key).trim(),
    }));
  }

  private buildTicketChannelName(category: TicketCategoryConfig, ticketNumber: number): string {
    const paddedTicketNumber = padTicketNumber(ticketNumber, this.config.naming.zeroPadLength);
    const template = category.channelNameTemplate || `${this.config.naming.ticketChannelPrefix}-{ticketNumber}`;
    const replaced = replaceTokens(template, {
      ticketNumber,
      paddedTicketNumber,
      categoryKey: category.key,
      categoryLabel: category.label,
    });

    return normalizeChannelName(replaced, this.config.naming.maxChannelNameLength);
  }

  private buildTicketTopic(ticketNumber: number, userTag: string, userId: string, category: TicketCategoryConfig): string {
    return replaceTokens(this.config.naming.topicTemplate, {
      ticketNumber,
      paddedTicketNumber: padTicketNumber(ticketNumber, this.config.naming.zeroPadLength),
      userTag,
      userId,
      categoryLabel: category.label,
      categoryKey: category.key,
    });
  }

  private buildPermissionOverwrites(guild: Guild, openerId: string, category: TicketCategoryConfig) {
    const staffRoleIds = uniqueStrings([
      ...this.config.guild.supportRoleIds,
      ...this.config.guild.managerRoleIds,
      ...category.supportRoleIds,
    ]);
    const botMemberId = guild.members.me?.id;

    return [
      {
        id: guild.roles.everyone.id,
        deny: [PermissionFlagsBits.ViewChannel],
      },
      {
        id: openerId,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ReadMessageHistory,
          PermissionFlagsBits.AttachFiles,
          PermissionFlagsBits.EmbedLinks,
          PermissionFlagsBits.AddReactions,
          PermissionFlagsBits.UseExternalEmojis,
        ],
      },
      ...(botMemberId
        ? [
            {
              id: botMemberId,
              allow: [
                PermissionFlagsBits.ViewChannel,
                PermissionFlagsBits.SendMessages,
                PermissionFlagsBits.ReadMessageHistory,
                PermissionFlagsBits.AttachFiles,
                PermissionFlagsBits.EmbedLinks,
                PermissionFlagsBits.AddReactions,
                PermissionFlagsBits.UseExternalEmojis,
                PermissionFlagsBits.ManageChannels,
                PermissionFlagsBits.ManageMessages,
              ],
            },
          ]
        : []),
      ...staffRoleIds.map((roleId) => ({
        id: roleId,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ReadMessageHistory,
          PermissionFlagsBits.AttachFiles,
          PermissionFlagsBits.EmbedLinks,
          PermissionFlagsBits.AddReactions,
          PermissionFlagsBits.UseExternalEmojis,
          PermissionFlagsBits.ManageMessages,
        ],
      })),
    ];
  }

  private async sendLog(
    guild: Guild,
    embed: EmbedBuilder,
    attachments: AttachmentBuilder[] = [],
  ): Promise<void> {
    const channel = await guild.channels.fetch(this.config.guild.logChannelId).catch(() => null);
    if (!isGuildTextChannelType(channel)) {
      return;
    }

    await channel.send({
      embeds: [embed],
      files: attachments,
    });
  }

  private async sendTranscript(guild: Guild, ticket: TicketRecord, channel: TextChannel): Promise<void> {
    const transcriptChannel = await guild.channels.fetch(this.config.guild.transcriptChannelId).catch(() => null);
    if (!isGuildTextChannelType(transcriptChannel)) {
      return;
    }

    const attachment = await this.transcriptService.buildAttachment(
      channel,
      ticket,
      this.config.naming.zeroPadLength,
    );

    const embed = buildSuccessEmbed(
      this.config,
      'Transcript',
      `Ticket #${padTicketNumber(ticket.ticket_number, this.config.naming.zeroPadLength)} transcript has been generated.`,
    )
      .addFields(
        {
          name: 'Channel',
          value: channel.name,
          inline: true,
        },
        {
          name: 'Creator',
          value: `<@${ticket.creator_id}>`,
          inline: true,
        },
      );

    await transcriptChannel.send({
      embeds: [embed],
      files: [attachment],
    });
  }

  private buildOpenLogEmbed(ticket: TicketRecord, channelId: string): EmbedBuilder {
    return buildSuccessEmbed(this.config, 'New Ticket', `تم فتح التذكرة <#${channelId}> بنجاح.`).addFields(
      {
        name: 'رقم التذكرة',
        value: `#${padTicketNumber(ticket.ticket_number, this.config.naming.zeroPadLength)}`,
        inline: true,
      },
      {
        name: 'صاحب التذكرة',
        value: `<@${ticket.creator_id}>`,
        inline: true,
      },
      {
        name: 'التصنيف',
        value: ticket.category_label,
        inline: true,
      },
      {
        name: 'الإجابات',
        value: ticket.answers
          .map((answer) => `**${answer.label}**\n${truncateText(answer.value, 300)}`)
          .join('\n\n')
          .slice(0, 1024) || 'لا توجد إجابات.',
      },
    );
  }

  private buildCloseLogEmbed(ticket: TicketRecord, closedById: string, archivedChannelName: string): EmbedBuilder {
    return buildSuccessEmbed(this.config, 'Ticket Closed', `تم إغلاق التذكرة #${ticket.ticket_number}.`).addFields(
      {
        name: 'رقم التذكرة',
        value: `#${padTicketNumber(ticket.ticket_number, this.config.naming.zeroPadLength)}`,
        inline: true,
      },
      {
        name: 'صاحب التذكرة',
        value: `<@${ticket.creator_id}>`,
        inline: true,
      },
      {
        name: 'تم الإغلاق بواسطة',
        value: `<@${closedById}>`,
        inline: true,
      },
      {
        name: 'القناة المؤرشفة',
        value: archivedChannelName,
        inline: false,
      },
    );
  }

  private async findExistingOpenTicket(guildId: string, userId: string): Promise<TicketRecord | null> {
    if (!this.config.limits.allowOnlyOneOpenTicketPerUser) {
      return null;
    }

    return this.ticketRepository.findOpenByCreator(guildId, userId);
  }

  public async handleOpenSelect(interaction: StringSelectMenuInteraction): Promise<void> {
    if (!interaction.inCachedGuild()) {
      await interaction.reply({ ephemeral: true, embeds: [buildErrorEmbed(this.config, 'This action only works inside the guild.')] });
      return;
    }

    const categoryKey = interaction.values[0];
    const category = this.getEnabledCategory(categoryKey);

    if (!category) {
      await interaction.reply({
        ephemeral: true,
        embeds: [buildErrorEmbed(this.config, 'التصنيف المحدد غير موجود أو معطل.')],
      });
      return;
    }

    const existing = await this.findExistingOpenTicket(interaction.guildId, interaction.user.id);
    if (existing?.channel_id) {
      await interaction.reply({
        ephemeral: true,
        embeds: [buildAlreadyOpenEmbed(this.config, existing.channel_id)],
      });
      return;
    }

    await interaction.showModal(buildOpenTicketModal(category));
  }

  public async handleOpenModal(interaction: ModalSubmitInteraction): Promise<void> {
    if (!interaction.inCachedGuild()) {
      await interaction.reply({ ephemeral: true, embeds: [buildErrorEmbed(this.config, 'This action only works inside the guild.')] });
      return;
    }

    const categoryKey = extractOpenTicketCategoryKey(interaction.customId);
    const category = categoryKey ? this.getEnabledCategory(categoryKey) : undefined;

    if (!category) {
      await interaction.reply({
        ephemeral: true,
        embeds: [buildErrorEmbed(this.config, 'تعذر تحديد بيانات هذه التذكرة.')],
      });
      return;
    }

    await interaction.deferReply({ ephemeral: true });

    const existing = await this.findExistingOpenTicket(interaction.guildId, interaction.user.id);
    if (existing?.channel_id) {
      await interaction.editReply({ embeds: [buildAlreadyOpenEmbed(this.config, existing.channel_id)] });
      return;
    }

    const answers = this.buildAnswers(interaction, category);
    let createdChannel: TextChannel | null = null;
    let createdTicket: TicketRecord | null = null;

    try {
      const ticketNumber = await this.ticketRepository.nextTicketNumber();
      const channelName = this.buildTicketChannelName(category, ticketNumber);
      const topic = this.buildTicketTopic(ticketNumber, interaction.user.tag, interaction.user.id, category);

      const created = await interaction.guild.channels.create({
        name: channelName,
        type: ChannelType.GuildText,
        parent: this.config.guild.categoryId,
        topic,
        permissionOverwrites: this.buildPermissionOverwrites(interaction.guild, interaction.user.id, category),
      });

      if (!isGuildTextChannelType(created) || created.type !== ChannelType.GuildText) {
        throw new Error('Created channel is not a guild text channel.');
      }

      createdChannel = created;

      createdTicket = await this.ticketRepository.createTicket({
        ticket_number: ticketNumber,
        guild_id: interaction.guildId,
        channel_id: created.id,
        channel_name: created.name,
        creator_id: interaction.user.id,
        creator_tag: interaction.user.tag,
        category_key: category.key,
        category_label: category.label,
        participant_ids: [],
        answers,
        metadata: {
          panelChannelId: this.config.panel.channelId,
          questionCount: answers.length,
          openedByAvatarUrl: interaction.user.displayAvatarURL(),
        },
      });

      const welcomeEmbeds = await buildTicketEmbeds(interaction.guild, this.config, createdTicket);
      const mentionRoles = formatRoleMentions([
        ...this.config.guild.mentionRolesOnOpen,
        ...category.supportRoleIds,
      ]);

      const sentMessage = await created.send({
        content: `${interaction.user} ${mentionRoles}`.trim(),
        embeds: welcomeEmbeds,
        components: buildTicketActionRows(this.config),
        allowedMentions: {
          users: [interaction.user.id],
          roles: uniqueStrings([
            ...this.config.guild.mentionRolesOnOpen,
            ...category.supportRoleIds,
          ]),
        },
      });

      if (this.config.limits.pinSummaryMessageOnCreate) {
        await sentMessage.pin().catch(() => null);
      }

      await this.sendLog(interaction.guild, this.buildOpenLogEmbed(createdTicket, created.id));

      await interaction.editReply({
        embeds: [
          buildSuccessEmbed(this.config, 'تم إنشاء التذكرة', `${this.config.ticket.messages.created} <#${created.id}>`),
        ],
      });
    } catch (error) {
      logger.error('Failed to open ticket', error instanceof Error ? error.message : error);

      if (createdTicket) {
        await this.ticketRepository.deleteTicketById(createdTicket.id).catch(() => null);
      }

      if (createdChannel) {
        await createdChannel.delete().catch(() => null);
      }

      if (error instanceof DuplicateOpenTicketError) {
        const duplicate = await this.ticketRepository.findOpenByCreator(interaction.guildId, interaction.user.id);
        const existingChannelId = duplicate?.channel_id || interaction.channelId || interaction.channel?.id;

        if (!existingChannelId) {
          await interaction.editReply({
            embeds: [buildErrorEmbed(this.config, 'تم اكتشاف تذكرة مفتوحة لكن تعذر تحديد القناة الخاصة بها.')],
          });
          return;
        }

        await interaction.editReply({
          embeds: [
            buildAlreadyOpenEmbed(this.config, existingChannelId),
          ],
        });
        return;
      }

      await interaction.editReply({
        embeds: [buildErrorEmbed(this.config, 'حدث خطأ أثناء إنشاء التذكرة.')],
      });
    }
  }

  private async resolveTicketContext(
    interaction: ButtonInteraction | ModalSubmitInteraction,
  ): Promise<ResolvedTicketContext | null> {
    if (!interaction.inCachedGuild() || !interaction.member || !interaction.channel) {
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply({ embeds: [buildErrorEmbed(this.config, this.config.ticket.messages.notInTicket)] });
      } else {
        await interaction.reply({ ephemeral: true, embeds: [buildErrorEmbed(this.config, this.config.ticket.messages.notInTicket)] });
      }

      return null;
    }

    const channelId = interaction.channelId || interaction.channel.id;
    if (!channelId) {
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply({ embeds: [buildErrorEmbed(this.config, this.config.ticket.messages.notInTicket)] });
      } else {
        await interaction.reply({ ephemeral: true, embeds: [buildErrorEmbed(this.config, this.config.ticket.messages.notInTicket)] });
      }

      return null;
    }

    const ticket = await this.ticketRepository.findByChannelId(channelId);
    if (!ticket || !ticket.channel_id) {
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply({ embeds: [buildErrorEmbed(this.config, this.config.ticket.messages.notInTicket)] });
      } else {
        await interaction.reply({ ephemeral: true, embeds: [buildErrorEmbed(this.config, this.config.ticket.messages.notInTicket)] });
      }

      return null;
    }

    const channel = await interaction.guild.channels.fetch(ticket.channel_id).catch(() => null);
    if (!isGuildTextChannelType(channel) || channel.type !== ChannelType.GuildText) {
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply({ embeds: [buildErrorEmbed(this.config, 'لم يتم العثور على قناة التذكرة.')] });
      } else {
        await interaction.reply({ ephemeral: true, embeds: [buildErrorEmbed(this.config, 'لم يتم العثور على قناة التذكرة.')] });
      }

      return null;
    }

    return {
      config: this.config,
      ticket,
      guild: interaction.guild,
      member: interaction.member as GuildMember,
      channel,
    };
  }

  private async ensureManagerAccess(interaction: ButtonInteraction | ModalSubmitInteraction): Promise<ResolvedTicketContext | null> {
    const context = await this.resolveTicketContext(interaction);
    if (!context) {
      return null;
    }

    if (!canManageTicket(context.member, context.config)) {
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply({ embeds: [buildErrorEmbed(this.config, this.config.ticket.messages.noPermission)] });
      } else {
        await interaction.reply({ ephemeral: true, embeds: [buildErrorEmbed(this.config, this.config.ticket.messages.noPermission)] });
      }

      return null;
    }

    return context;
  }

  public async handleTicketButton(interaction: ButtonInteraction): Promise<void> {
    switch (interaction.customId) {
      case TICKET_BUTTON_IDS.close:
        await this.handleCloseTicket(interaction);
        return;
      case TICKET_BUTTON_IDS.add:
        await this.handleAddMemberButton(interaction);
        return;
      case TICKET_BUTTON_IDS.remove:
        await this.handleRemoveMemberButton(interaction);
        return;
      case TICKET_BUTTON_IDS.claim:
        await this.handleClaimButton(interaction);
        return;
      case TICKET_BUTTON_IDS.pin:
        await this.handlePinButton(interaction);
        return;
      default:
        return;
    }
  }

  private async handleCloseTicket(interaction: ButtonInteraction): Promise<void> {
    await interaction.deferReply({ ephemeral: true });

    const context = await this.resolveTicketContext(interaction);
    if (!context) {
      return;
    }

    const isCreator = context.ticket.creator_id === interaction.user.id;
    const isManager = canManageTicket(context.member, context.config);

    if (!isCreator && !isManager) {
      await interaction.editReply({ embeds: [buildErrorEmbed(this.config, this.config.ticket.messages.noPermission)] });
      return;
    }

    try {
      const closedTicket = await this.ticketRepository.closeByChannel(context.channel.id, {
        closed_by: interaction.user.id,
        closed_by_tag: interaction.user.tag,
        close_reason: 'Closed via ticket button',
      });

      await this.sendTranscript(context.guild, closedTicket, context.channel).catch((error) => {
        logger.warn('Failed to generate transcript', error instanceof Error ? error.message : error);
      });

      const archivedName = normalizeChannelName(
        `closed-${padTicketNumber(closedTicket.ticket_number, this.config.naming.zeroPadLength)}`,
        this.config.naming.maxChannelNameLength,
      );

      await context.channel.setName(archivedName).catch(() => null);
      await context.channel.setParent(this.config.guild.archiveCategoryId).catch(() => null);
      await context.channel.permissionOverwrites.edit(context.ticket.creator_id, {
        ViewChannel: false,
        SendMessages: false,
      }).catch(() => null);

      for (const participantId of context.ticket.participant_ids) {
        await context.channel.permissionOverwrites.edit(participantId, {
          ViewChannel: false,
          SendMessages: false,
        }).catch(() => null);
      }

      const closedEmbed = buildSuccessEmbed(this.config, 'Ticket Closed', `${this.config.ticket.messages.closed}\nClosed by ${interaction.user}.`);
      await context.channel.send({ embeds: [closedEmbed] }).catch(() => null);
      await this.sendLog(context.guild, this.buildCloseLogEmbed(closedTicket, interaction.user.id, archivedName));

      await interaction.editReply({
        embeds: [buildSuccessEmbed(this.config, 'تم', `${this.config.ticket.messages.closed}\n${context.channel}`)],
      });
    } catch (error) {
      logger.error('Failed to close ticket', error instanceof Error ? error.message : error);
      await interaction.editReply({ embeds: [buildErrorEmbed(this.config, 'تعذر إغلاق التذكرة حالياً.')] });
    }
  }

  private async handleAddMemberButton(interaction: ButtonInteraction): Promise<void> {
    const context = await this.ensureManagerAccess(interaction);
    if (!context) {
      return;
    }

    await interaction.showModal(buildAddMemberModal());
  }

  private async handleRemoveMemberButton(interaction: ButtonInteraction): Promise<void> {
    const context = await this.ensureManagerAccess(interaction);
    if (!context) {
      return;
    }

    await interaction.showModal(buildRemoveMemberModal());
  }

  private async handleClaimButton(interaction: ButtonInteraction): Promise<void> {
    await interaction.deferReply({ ephemeral: true });

    const context = await this.ensureManagerAccess(interaction);
    if (!context) {
      return;
    }

    try {
      const isAlreadyClaimed = context.ticket.claimed_by !== null;
      const isClaimedBySelf = context.ticket.claimed_by === interaction.user.id;

      if (isAlreadyClaimed && !isClaimedBySelf) {
        await interaction.editReply({
          embeds: [buildErrorEmbed(this.config, `هذه التذكرة مستلمة بالفعل بواسطة <@${context.ticket.claimed_by}>.`)],
        });
        return;
      }

      const newClaimerId = isClaimedBySelf ? null : interaction.user.id;
      const newClaimerTag = isClaimedBySelf ? null : interaction.user.tag;

      const updated = await this.ticketRepository.updateClaimState(
        context.channel.id,
        newClaimerId,
        newClaimerTag,
      );

      await this.applyClaimPermissions(context, newClaimerId);

      const message = isClaimedBySelf
        ? `${this.config.ticket.messages.unclaimed}`
        : `${this.config.ticket.messages.claimed} ${interaction.user}`;

      await context.channel.send({
        embeds: [buildSuccessEmbed(this.config, 'Claim Status', message)],
      });

      await this.sendLog(
        context.guild,
        buildSuccessEmbed(this.config, 'Ticket Claim Updated', message).addFields(
          {
            name: 'Ticket',
            value: `#${padTicketNumber(updated.ticket_number, this.config.naming.zeroPadLength)}`,
            inline: true,
          },
          {
            name: 'Channel',
            value: `<#${context.channel.id}>`,
            inline: true,
          },
        ),
      );

      await interaction.editReply({ embeds: [buildSuccessEmbed(this.config, 'تم', message)] });
    } catch (error) {
      logger.error('Failed to update claim state', error instanceof Error ? error.message : error);
      await interaction.editReply({ embeds: [buildErrorEmbed(this.config, 'تعذر تحديث حالة الاستلام.')] });
    }
  }

  private async applyClaimPermissions(
    context: ResolvedTicketContext,
    claimerId: string | null,
  ): Promise<void> {
    const staffRoleIds = uniqueStrings([
      ...this.config.guild.supportRoleIds,
      ...this.config.guild.managerRoleIds,
    ]);

    const categoryConfig = this.config.categories.find((c) => c.key === context.ticket.category_key);
    if (categoryConfig) {
      staffRoleIds.push(...categoryConfig.supportRoleIds);
    }

    const uniqueStaffRoles = uniqueStrings(staffRoleIds);

    if (claimerId) {
      for (const roleId of uniqueStaffRoles) {
        await context.channel.permissionOverwrites.edit(roleId, {
          ViewChannel: true,
          SendMessages: false,
          ReadMessageHistory: true,
          AttachFiles: false,
          EmbedLinks: false,
          AddReactions: true,
          UseExternalEmojis: true,
        }).catch(() => null);
      }

      await context.channel.permissionOverwrites.edit(claimerId, {
        ViewChannel: true,
        SendMessages: true,
        ReadMessageHistory: true,
        AttachFiles: true,
        EmbedLinks: true,
        AddReactions: true,
        UseExternalEmojis: true,
        ManageMessages: true,
      }).catch(() => null);

      await context.channel.permissionOverwrites.edit(context.ticket.creator_id, {
        ViewChannel: true,
        SendMessages: true,
        ReadMessageHistory: true,
        AttachFiles: true,
        EmbedLinks: true,
        AddReactions: true,
        UseExternalEmojis: true,
      }).catch(() => null);
    } else {
      for (const roleId of uniqueStaffRoles) {
        await context.channel.permissionOverwrites.edit(roleId, {
          ViewChannel: true,
          SendMessages: true,
          ReadMessageHistory: true,
          AttachFiles: true,
          EmbedLinks: true,
          AddReactions: true,
          UseExternalEmojis: true,
          ManageMessages: true,
        }).catch(() => null);
      }
    }
  }

  private async handlePinButton(interaction: ButtonInteraction): Promise<void> {
    await interaction.deferReply({ ephemeral: true });

    const context = await this.ensureManagerAccess(interaction);
    if (!context) {
      return;
    }

    try {
      await interaction.message.pin();
      await interaction.editReply({
        embeds: [buildSuccessEmbed(this.config, 'Pinned', 'تم تثبيت رسالة التذكرة بنجاح.')],
      });
    } catch {
      await interaction.editReply({
        embeds: [buildErrorEmbed(this.config, 'تعذر تثبيت هذه الرسالة، ربما هي مثبتة مسبقاً.')],
      });
    }
  }

  public async handleMemberModal(interaction: ModalSubmitInteraction): Promise<boolean> {
    if (interaction.customId !== ADD_MEMBER_MODAL_ID && interaction.customId !== REMOVE_MEMBER_MODAL_ID) {
      return false;
    }

    await interaction.deferReply({ ephemeral: true });

    const context = await this.ensureManagerAccess(interaction);
    if (!context) {
      return true;
    }

    const rawValue = interaction.fields.getTextInputValue(MEMBER_MODAL_FIELD_ID);
    const memberId = normalizeSnowflake(rawValue);

    if (!memberId) {
      await interaction.editReply({
        embeds: [buildErrorEmbed(this.config, 'المعرف أو المنشن غير صالح.')],
      });
      return true;
    }

    const member = await context.guild.members.fetch(memberId as Snowflake).catch(() => null);
    if (!member) {
      await interaction.editReply({
        embeds: [buildErrorEmbed(this.config, 'تعذر العثور على هذا العضو داخل السيرفر.')],
      });
      return true;
    }

    try {
      if (interaction.customId === ADD_MEMBER_MODAL_ID) {
        await context.channel.permissionOverwrites.edit(member.id, {
          ViewChannel: true,
          SendMessages: true,
          ReadMessageHistory: true,
          AttachFiles: true,
          EmbedLinks: true,
          AddReactions: true,
          UseExternalEmojis: true,
        });

        const participantIds = uniqueStrings([...context.ticket.participant_ids, member.id]);
        await this.ticketRepository.replaceParticipants(context.channel.id, participantIds);
        await context.channel.send({
          embeds: [buildSuccessEmbed(this.config, 'Member Added', `${this.config.ticket.messages.addedMember} ${member}`)],
        });

        await interaction.editReply({
          embeds: [buildSuccessEmbed(this.config, 'تم', `${this.config.ticket.messages.addedMember} ${member}`)],
        });
        return true;
      }

      if (member.id === context.ticket.creator_id) {
        await interaction.editReply({
          embeds: [buildErrorEmbed(this.config, 'لا يمكن إزالة صاحب التذكرة الأساسي من التذكرة.')],
        });
        return true;
      }

      await context.channel.permissionOverwrites.delete(member.id).catch(() => null);
      const participantIds = context.ticket.participant_ids.filter((participantId) => participantId !== member.id);
      await this.ticketRepository.replaceParticipants(context.channel.id, participantIds);
      await context.channel.send({
        embeds: [buildSuccessEmbed(this.config, 'Member Removed', `${this.config.ticket.messages.removedMember} ${member}`)],
      });

      await interaction.editReply({
        embeds: [buildSuccessEmbed(this.config, 'تم', `${this.config.ticket.messages.removedMember} ${member}`)],
      });
      return true;
    } catch (error) {
      logger.error('Failed to update ticket members', error instanceof Error ? error.message : error);
      await interaction.editReply({
        embeds: [buildErrorEmbed(this.config, 'تعذر تعديل أعضاء التذكرة حالياً.')],
      });
      return true;
    }
  }
}
