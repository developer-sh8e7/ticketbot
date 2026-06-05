import {
  ActionRowBuilder,
  AttachmentBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  EmbedBuilder,
  MessageFlags,
  ModalBuilder,
  PermissionFlagsBits,
  TextInputBuilder,
  TextInputStyle,
  type ButtonInteraction,
  type ChatInputCommandInteraction,
  type Guild,
  type GuildMember,
  type ModalSubmitInteraction,
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
  isAuthorizedAdmin,
} from '../constants/customIds.js';
import { DuplicateOpenTicketError, TicketRepository } from '../database/ticketRepository.js';
import { MediatorRepository } from '../database/mediatorRepository.js';
import type { TicketRecord } from '../database/types.js';
import type { AppConfig, TicketAnswer, TicketCategoryConfig } from '../types/config.js';
import { hexToDecimal } from '../utils/color.js';
import { isGuildTextChannelType } from '../utils/discord.js';
import { isInteractionLifecycleError, safeDeferReply, safeEditReply, safeReply, safeShowModal } from '../utils/interaction.js';
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
import { parseTradeAmountSmartly } from '../utils/text.js';
import { canManageTicket } from './permissionService.js';
import { ConfigStore } from './configStore.js';
import { TranscriptService } from './transcriptService.js';

interface TicketServiceDependencies {
  configStore: ConfigStore;
  ticketRepository: TicketRepository;
  transcriptService: TranscriptService;
  mediatorRepository: MediatorRepository;
}

interface ResolvedTicketContext {
  config: AppConfig;
  ticket: TicketRecord;
  guild: Guild;
  member: GuildMember;
  channel: TextChannel;
}

const MIDDLEMAN_ROLE_ID = '1506010306407694346';
const MIDDLEMAN_ROLE_NAME = 'وسيط مضمون';
const MIDDLEMAN_LABEL = 'مضمون';

export class TicketService {
  private readonly configStore: ConfigStore;
  private readonly ticketRepository: TicketRepository;
  private readonly transcriptService: TranscriptService;
  private readonly mediatorRepository: MediatorRepository;
  private readonly instanceId = Math.random().toString(36).slice(2, 8);
  private readonly activeCreations = new Set<string>();
  private readonly activeTransitions = new Set<string>();

  public constructor(dependencies: TicketServiceDependencies) {
    this.configStore = dependencies.configStore;
    this.ticketRepository = dependencies.ticketRepository;
    this.transcriptService = dependencies.transcriptService;
    this.mediatorRepository = dependencies.mediatorRepository;
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

  private buildTicketChannelName(category: TicketCategoryConfig, ticketNumber: number, answers?: TicketAnswer[]): string {
    const paddedTicketNumber = padTicketNumber(ticketNumber, this.config.naming.zeroPadLength);

    if (category.key === 'middleman') {
      return normalizeChannelName(`وسيط-مضمون-${paddedTicketNumber}`, this.config.naming.maxChannelNameLength);
    }

    const template = category.channelNameTemplate || `${this.config.naming.ticketChannelPrefix}-{ticketNumber}`;
    
    let houseColor = '';
    if (category.key === 'house_unlock' && answers) {
      const colorAnswer = answers.find((ans) => ans.key === 'house_color')?.value;
      houseColor = colorAnswer || '';
    }
    
    const replaced = replaceTokens(template, {
      ticketNumber,
      paddedTicketNumber,
      categoryKey: category.key,
      categoryLabel: category.label,
      houseColor,
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
    const botMemberId = guild.members.me?.id;

    if (category.key === 'mediator_apply') {
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
      ];
    }

    const supportRoleIdsToAllow = category.key === 'middleman' ? [MIDDLEMAN_ROLE_ID] : [...category.supportRoleIds];

    const staffRoleIds = uniqueStrings([
      ...this.config.guild.supportRoleIds,
      ...this.config.guild.managerRoleIds,
      ...supportRoleIdsToAllow,
    ]);
    const filteredStaffRoleIds = staffRoleIds.filter((roleId) => guild.roles.cache.has(roleId));

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
      ...filteredStaffRoleIds.map((roleId) => ({
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
      await safeReply(interaction, [buildErrorEmbed(this.config, 'This action only works inside the guild.')]);
      return;
    }

    const categoryKey = interaction.values[0];
    const category = this.getEnabledCategory(categoryKey);

    if (!category) {
      await safeReply(interaction, [buildErrorEmbed(this.config, 'التصنيف المحدد غير موجود أو معطل.')]);
      return;
    }

    if (category.key === 'mediator_apply') {
      await interaction.reply({
        embeds: [
          buildErrorEmbed(
            this.config,
            'تم تحديث نظام التقديم. استخدم زر التقديم على رتبة وسيط الموجود أسفل لوحة التذاكر.',
          ),
        ],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (!category.questions || category.questions.length === 0) {
      await this.processTicketCreation(interaction, category, []);
      return;
    }

    try {
      const modal = buildOpenTicketModal(category);
      const shown = await safeShowModal(interaction, modal, `open-select:${category.key}`);
      if (!shown) {
        return;
      }
    } catch (error) {
      logger.error('Failed to show ticket modal', error instanceof Error ? error.message : error);
      if (isInteractionLifecycleError(error)) {
        return;
      }

      await safeReply(interaction, [buildErrorEmbed(this.config, 'تعذر فتح نموذج التذكرة، يرجى المحاولة مرة أخرى.')]);
    }
  }

  public async handleOpenModal(interaction: ModalSubmitInteraction): Promise<void> {
    if (!interaction.inCachedGuild()) {
      await safeReply(interaction, [buildErrorEmbed(this.config, 'This action only works inside the guild.')]);
      return;
    }

    const categoryKey = extractOpenTicketCategoryKey(interaction.customId);
    const category = categoryKey ? this.getEnabledCategory(categoryKey) : undefined;

    if (!category) {
      await safeReply(interaction, [buildErrorEmbed(this.config, 'تعذر تحديد بيانات هذه التذكرة.')]);
      return;
    }

    if (category.key === 'mediator_apply') {
      await interaction.reply({
        embeds: [
          buildErrorEmbed(
            this.config,
            'تم تحديث نظام التقديم. استخدم زر التقديم على رتبة وسيط الموجود أسفل لوحة التذاكر.',
          ),
        ],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const answers = this.buildAnswers(interaction, category);
    await this.processTicketCreation(interaction, category, answers);
  }

  private async processTicketCreation(
    interaction: StringSelectMenuInteraction | ModalSubmitInteraction,
    category: TicketCategoryConfig,
    answers: TicketAnswer[]
  ): Promise<void> {
    if (!interaction.inCachedGuild()) return;

    const userId = interaction.user.id;
    if (this.activeCreations.has(userId)) {
      logger.info(`[instance=${this.instanceId}] [TICKET_CREATE_REJECTED] Creator ${userId} is already in active creations.`);
      await safeReply(interaction, [buildErrorEmbed(this.config, '⚠️ يرجى الانتظار، يتم حالياً إنشاء تذكرتك...')]);
      return;
    }
    this.activeCreations.add(userId);
    logger.info(`[instance=${this.instanceId}] [TICKET_CREATE_START] Creator: ${userId}`);

    try {
      if (!(await safeDeferReply(interaction, `open-modal:${category.key}`))) {
        return;
      }

      const existing = await this.findExistingOpenTicket(interaction.guildId, interaction.user.id);
      if (existing?.channel_id) {
        const existingChannel = await interaction.guild.channels.fetch(existing.channel_id).catch(() => null);
        if (!existingChannel) {
          await this.ticketRepository.closeByChannel(existing.channel_id, {
            closed_by: interaction.user.id,
            closed_by_tag: interaction.user.tag,
            close_reason: 'Auto-closed: channel no longer exists',
          }).catch(() => null);
          logger.info(`Auto-closed stale ticket #${existing.ticket_number} (channel deleted)`);
        } else {
          await safeEditReply(interaction, [buildAlreadyOpenEmbed(this.config, existing.channel_id)]);
          return;
        }
      }

      let createdChannel: TextChannel | null = null;
      let createdTicket: TicketRecord | null = null;

      try {
        const tradeAmountValue = answers.find((ans) => ans.key === 'trade_amount')?.value;
        const tradeAmount = tradeAmountValue ? await parseTradeAmountSmartly(tradeAmountValue) : null;

        const ticketNumber = await this.ticketRepository.nextTicketNumber();
        const channelName = this.buildTicketChannelName(category, ticketNumber, answers);
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
            ...(category.key === 'middleman'
              ? {
                  trade_value: tradeAmount,
                  mediator_role_id: MIDDLEMAN_ROLE_ID,
                  mediator_role_name: MIDDLEMAN_ROLE_NAME,
                }
              : {}),
          },
        });

        let supportRolesToMention = [...category.supportRoleIds];
        let mentionRolesOnOpen = [...this.config.guild.mentionRolesOnOpen];
        if (category.key === 'middleman') {
          supportRolesToMention = [MIDDLEMAN_ROLE_ID];
        } else if (category.key === 'mediator_apply') {
          supportRolesToMention = [];
          mentionRolesOnOpen = [];
        }

        const welcomeEmbeds = await buildTicketEmbeds(interaction.guild, this.config, createdTicket);
        const validMentions = [
          ...mentionRolesOnOpen,
          ...supportRolesToMention,
        ].filter((roleId) => interaction.guild.roles.cache.has(roleId));

        const mentionRoles = formatRoleMentions(validMentions);

        const sentMessage = await created.send({
          content: `${interaction.user} ${mentionRoles}`.trim(),
          embeds: welcomeEmbeds,
          components: buildTicketActionRows(this.config),
          allowedMentions: {
            users: [interaction.user.id],
            roles: uniqueStrings(validMentions),
          },
        });

        if (this.config.limits.pinSummaryMessageOnCreate) {
          await sentMessage.pin().catch(() => null);
        }

        await this.sendLog(interaction.guild, this.buildOpenLogEmbed(createdTicket, created.id));

        if (category.key === 'mediator_apply') {
          try {
            const adminUser = await interaction.client.users.fetch('1397364822152315052');
            if (adminUser) {
              const dmEmbed = new EmbedBuilder()
                .setColor(hexToDecimal(this.config.bot.embedColor))
                .setTitle('🔔 تقديم جديد على رتبة وسيط')
                .setDescription(
                  `قام العضو **${interaction.user.tag}** (${interaction.user}) بالتقديم على رتبة وسيط.\n\n` +
                  `• **معرف العضو**: \`${interaction.user.id}\`\n` +
                  `• **رقم التذكرة**: \`#${ticketNumber}\`\n` +
                  `• **رابط التذكرة**: <#${created.id}>`
                )
                .addFields(
                  {
                    name: 'الإجابات المقدمة',
                    value: answers
                      .map((ans) => `**${ans.label}**:\n${ans.value}`)
                      .join('\n\n')
                      .slice(0, 1024) || 'لا توجد إجابات.'
                  }
                )
                .setTimestamp();

              await adminUser.send({ embeds: [dmEmbed] });
              logger.info(`Successfully sent mediator application DM notification to admin 1397364822152315052`);
            }
          } catch (dmError) {
            logger.error('Failed to send DM notification to admin 1397364822152315052', dmError);
          }
        }

        await safeEditReply(interaction, [buildSuccessEmbed(this.config, 'تم إنشاء التذكرة', `${this.config.ticket.messages.created} <#${created.id}>`)]);
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
            await safeEditReply(interaction, [buildErrorEmbed(this.config, 'تم اكتشاف تذكرة مفتوحة لكن تعذر تحديد القناة الخاصة بها.')]);
            return;
          }

          await safeEditReply(interaction, [buildAlreadyOpenEmbed(this.config, existingChannelId)]);
          return;
        }

        await safeEditReply(interaction, [buildErrorEmbed(this.config, 'حدث خطأ أثناء إنشاء التذكرة.')]);
      }
    } finally {
      this.activeCreations.delete(userId);
      logger.info(`[instance=${this.instanceId}] [TICKET_CREATE_END] Creator: ${userId}`);
    }
  }

  private async resolveTicketContext(
    interaction: ButtonInteraction | ModalSubmitInteraction,
  ): Promise<ResolvedTicketContext | null> {
    if (!interaction.inCachedGuild() || !interaction.member || !interaction.channel) {
      if (interaction.deferred || interaction.replied) {
        await safeEditReply(interaction, [buildErrorEmbed(this.config, this.config.ticket.messages.notInTicket)]);
      } else {
        await safeReply(interaction, [buildErrorEmbed(this.config, this.config.ticket.messages.notInTicket)]);
      }

      return null;
    }

    const channelId = interaction.channelId || interaction.channel.id;
    if (!channelId) {
      if (interaction.deferred || interaction.replied) {
        await safeEditReply(interaction, [buildErrorEmbed(this.config, this.config.ticket.messages.notInTicket)]);
      } else {
        await safeReply(interaction, [buildErrorEmbed(this.config, this.config.ticket.messages.notInTicket)]);
      }

      return null;
    }

    const ticket = await this.ticketRepository.findByChannelId(channelId);
    if (!ticket || !ticket.channel_id) {
      if (interaction.deferred || interaction.replied) {
        await safeEditReply(interaction, [buildErrorEmbed(this.config, this.config.ticket.messages.notInTicket)]);
      } else {
        await safeReply(interaction, [buildErrorEmbed(this.config, this.config.ticket.messages.notInTicket)]);
      }

      return null;
    }

    const channel = await interaction.guild.channels.fetch(ticket.channel_id).catch(() => null);
    if (!isGuildTextChannelType(channel) || channel.type !== ChannelType.GuildText) {
      if (interaction.deferred || interaction.replied) {
        await safeEditReply(interaction, [buildErrorEmbed(this.config, 'لم يتم العثور على قناة التذكرة.')]);
      } else {
        await safeReply(interaction, [buildErrorEmbed(this.config, 'لم يتم العثور على قناة التذكرة.')]);
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
        await safeEditReply(interaction, [buildErrorEmbed(this.config, this.config.ticket.messages.noPermission)]);
      } else {
        await safeReply(interaction, [buildErrorEmbed(this.config, this.config.ticket.messages.noPermission)]);
      }

      return null;
    }

    return context;
  }

  public async handleTicketButton(interaction: ButtonInteraction): Promise<void> {
    // Modal buttons must NOT be deferred — handle them first
    if (interaction.customId === TICKET_BUTTON_IDS.add) {
      await this.handleAddMemberButton(interaction);
      return;
    }
    if (interaction.customId === TICKET_BUTTON_IDS.remove) {
      await this.handleRemoveMemberButton(interaction);
      return;
    }

    // All other buttons: defer ASAP to avoid the 3-second expiry
    if (!(await safeDeferReply(interaction, `ticket-button:${interaction.customId}`))) {
      return;
    }

    switch (interaction.customId) {
      case TICKET_BUTTON_IDS.close:
        await this.handleCloseTicket(interaction);
        return;
      case TICKET_BUTTON_IDS.claim:
        await this.handleClaimButton(interaction);
        return;
      case TICKET_BUTTON_IDS.pin:
        await this.handlePinButton(interaction);
        return;
      case TICKET_BUTTON_IDS.stats:
        await this.handleStatsButton(interaction);
        return;
      case TICKET_BUTTON_IDS.proof:
        await this.handleProofButton(interaction);
        return;
      default:
        return;
    }
  }

  private async handleCloseTicket(interaction: ButtonInteraction): Promise<void> {
    const context = await this.resolveTicketContext(interaction);
    if (!context) {
      return;
    }

    const isCreator = context.ticket.creator_id === interaction.user.id;
    const isManager = canManageTicket(context.member, context.config);

    if (!isCreator && !isManager) {
      await safeEditReply(interaction, [buildErrorEmbed(this.config, this.config.ticket.messages.noPermission)]);
      return;
    }

    try {
      const closedTicket = await this.ticketRepository.closeByChannel(context.channel.id, {
        closed_by: interaction.user.id,
        closed_by_tag: interaction.user.tag,
        close_reason: 'Closed via ticket button',
      });

      await this.incrementCompletedTicket(closedTicket).catch(() => null);

      await this.sendCustomCloseLog(context.guild, closedTicket, interaction.user.id, context.channel).catch((error) => {
        logger.error('Failed to send custom close log', error);
      });

      await this.sendTranscript(context.guild, closedTicket, context.channel).catch((error) => {
        logger.warn('Failed to generate transcript', error instanceof Error ? error.message : error);
      });

      const channelName = context.channel.name;
      await this.sendLog(context.guild, this.buildCloseLogEmbed(closedTicket, interaction.user.id, channelName));

      await safeEditReply(interaction, [buildSuccessEmbed(this.config, 'تم', `${this.config.ticket.messages.closed}\n${context.channel}`)]);

      await context.channel.delete().catch(() => null);
    } catch (error) {
      logger.error('Failed to close ticket', error instanceof Error ? error.message : error);
      await safeEditReply(interaction, [buildErrorEmbed(this.config, 'تعذر إغلاق التذكرة حالياً.')]);
    }
  }

  private async handleAddMemberButton(interaction: ButtonInteraction): Promise<void> {
    await safeShowModal(interaction, buildAddMemberModal(), 'add-member-button');
  }

  private async handleRemoveMemberButton(interaction: ButtonInteraction): Promise<void> {
    await safeShowModal(interaction, buildRemoveMemberModal(), 'remove-member-button');
  }

  private async handleClaimButton(interaction: ButtonInteraction): Promise<void> {
    const context = await this.ensureManagerAccess(interaction);
    if (!context) {
      return;
    }

    try {
      const isAlreadyClaimed = context.ticket.claimed_by !== null;
      const isClaimedBySelf = context.ticket.claimed_by === interaction.user.id;

      if (isAlreadyClaimed && !isClaimedBySelf) {
        await safeEditReply(interaction, [buildErrorEmbed(this.config, `هذه التذكرة مستلمة بالفعل بواسطة <@${context.ticket.claimed_by}>.`)]);
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

      if (newClaimerId) {
        const mediator = await this.mediatorRepository.getMediator(newClaimerId).catch(() => null);
        if (mediator) {
          await this.mediatorRepository.updateMediator(newClaimerId, {
            tickets_claimed: (mediator.tickets_claimed || 0) + 1
          }).catch((err) => logger.error('Failed to increment mediator claimed tickets', err));
        }
      }

      await this.sendCustomClaimLog(context.guild, updated, newClaimerId).catch((error) => {
        logger.error('Failed to send custom claim log', error);
      });

      const nowClaimed = newClaimerId !== null;
      const newComponents = buildTicketActionRows(this.config, nowClaimed);
      await interaction.message.edit({ components: newComponents }).catch(() => null);

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

      await safeEditReply(interaction, [buildSuccessEmbed(this.config, 'تم', message)]);
    } catch (error) {
      logger.error('Failed to update claim state', error instanceof Error ? error.message : error);
      await safeEditReply(interaction, [buildErrorEmbed(this.config, 'تعذر تحديث حالة الاستلام.')]);
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

    // Allow both claimer and support staff to write
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

    if (claimerId) {
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
    }

    await context.channel.permissionOverwrites.edit(context.ticket.creator_id, {
      ViewChannel: true,
      SendMessages: true,
      ReadMessageHistory: true,
      AttachFiles: true,
      EmbedLinks: true,
      AddReactions: true,
      UseExternalEmojis: true,
    }).catch(() => null);
  }

  private async handlePinButton(interaction: ButtonInteraction): Promise<void> {
    const context = await this.ensureManagerAccess(interaction);
    if (!context) {
      return;
    }

    try {
      await interaction.message.pin();
      await safeEditReply(interaction, [buildSuccessEmbed(this.config, 'Pinned', 'تم تثبيت رسالة التذكرة بنجاح.')]);
    } catch {
      await safeEditReply(interaction, [buildErrorEmbed(this.config, 'تعذر تثبيت هذه الرسالة، ربما هي مثبتة مسبقاً.')]);
    }
  }

  public async handleMemberModal(interaction: ModalSubmitInteraction): Promise<boolean> {
    if (interaction.customId !== ADD_MEMBER_MODAL_ID && interaction.customId !== REMOVE_MEMBER_MODAL_ID) {
      return false;
    }

    if (!(await safeDeferReply(interaction, `member-modal:${interaction.customId}`))) {
      return true;
    }

    const context = await this.ensureManagerAccess(interaction);
    if (!context) {
      return true;
    }

    const rawValue = interaction.fields.getTextInputValue(MEMBER_MODAL_FIELD_ID);
    const memberId = normalizeSnowflake(rawValue);

    if (!memberId) {
      await safeEditReply(interaction, [buildErrorEmbed(this.config, 'المعرف أو المنشن غير صالح.')]);
      return true;
    }

    const member = await context.guild.members.fetch(memberId).catch(() => null);
    if (!member) {
      await safeEditReply(interaction, [buildErrorEmbed(this.config, 'تعذر العثور على هذا العضو داخل السيرفر.')]);
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

        await safeEditReply(interaction, [buildSuccessEmbed(this.config, 'تم', `${this.config.ticket.messages.addedMember} ${member}`)]);
        return true;
      }

      if (member.id === context.ticket.creator_id) {
        await safeEditReply(interaction, [buildErrorEmbed(this.config, 'لا يمكن إزالة صاحب التذكرة الأساسي من التذكرة.')]);
        return true;
      }

      await context.channel.permissionOverwrites.delete(member.id).catch(() => null);
      const participantIds = context.ticket.participant_ids.filter((participantId) => participantId !== member.id);
      await this.ticketRepository.replaceParticipants(context.channel.id, participantIds);
      await context.channel.send({
        embeds: [buildSuccessEmbed(this.config, 'Member Removed', `${this.config.ticket.messages.removedMember} ${member}`)],
      });

      await safeEditReply(interaction, [buildSuccessEmbed(this.config, 'تم', `${this.config.ticket.messages.removedMember} ${member}`)]);
      return true;
    } catch (error) {
      logger.error('Failed to update ticket members', error instanceof Error ? error.message : error);
      await safeEditReply(interaction, [buildErrorEmbed(this.config, 'تعذر تعديل أعضاء التذكرة حالياً.')]);
      return true;
    }
  }

  private async handleStatsButton(interaction: ButtonInteraction): Promise<void> {
    const allowedRoles = this.config.ticket.controls.stats?.allowedRoleIds ?? [];
    const member = interaction.member as GuildMember;
    const hasRole = allowedRoles.length === 0 || allowedRoles.some((roleId) => member.roles.cache.has(roleId) || member.id === roleId);

    if (!hasRole) {
      await safeEditReply(interaction, [buildErrorEmbed(this.config, this.config.ticket.messages.noPermission)]);
      return;
    }

    const context = await this.resolveTicketContext(interaction);
    if (!context) return;

    try {
      const stats = await this.ticketRepository.getStats(context.guild.id);

      const embed = new EmbedBuilder()
        .setColor(hexToDecimal(this.config.bot.embedColor))
        .setTitle('إحصائيات التذاكر')
        .addFields(
          { name: 'التذاكر المفتوحة', value: `${stats.open}`, inline: true },
          { name: 'التذاكر المغلقة', value: `${stats.closed}`, inline: true },
          { name: 'إجمالي التذاكر', value: `${stats.total}`, inline: true },
          { name: 'التذكرة الحالية', value: `#${padTicketNumber(context.ticket.ticket_number, this.config.naming.zeroPadLength)}`, inline: true },
          { name: 'صاحب التذكرة', value: `<@${context.ticket.creator_id}>`, inline: true },
          { name: 'الحالة', value: context.ticket.status === 'open' ? 'مفتوحة' : 'مغلقة', inline: true },
        )
        .setFooter({ text: this.config.bot.footerText })
        .setTimestamp();

      if (context.ticket.claimed_by) {
        embed.addFields({ name: 'مستلمة بواسطة', value: `<@${context.ticket.claimed_by}>`, inline: true });
      }

      await safeEditReply(interaction, [embed]);
    } catch (error) {
      logger.error('Failed to fetch stats via button', error instanceof Error ? error.message : error);
      await safeEditReply(interaction, [buildErrorEmbed(this.config, 'تعذر جلب الإحصائيات.')]);
    }
  }

  private async handleProofButton(interaction: ButtonInteraction): Promise<void> {
    const context = await this.ensureManagerAccess(interaction);
    if (!context) {
      return;
    }

    const ticket = await this.ticketRepository.findByChannelId(context.channel.id);
    if (!ticket) {
      await safeEditReply(interaction, [buildErrorEmbed(this.config, '❌ تعذر العثور على بيانات التذكرة في قاعدة البيانات.')]);
      return;
    }

    await safeEditReply(interaction, [
      buildSuccessEmbed(
        this.config,
        '📤 رفع دليل التسليم',
        'يرجى إرسال ملف دليل التسليم (صورة، فيديو، أو ملف) في هذه القناة الآن.\nسيقوم النظام بحفظ الدليل بشكل دائم ومستمر.\n\n⏱️ **لديك 60 ثانية لرفع الملف.**'
      )
    ]);

    const filter = (m: any) => m.author.id === interaction.user.id && m.attachments.size > 0;
    const collector = context.channel.createMessageCollector({
      filter,
      max: 1,
      time: 60000,
    });

    let collected = false;

    collector.on('collect', async (msg) => {
      collected = true;

      const processingMsg = await context.channel.send({
        embeds: [buildSuccessEmbed(this.config, '🔄 جاري المعالجة', 'جاري حفظ دليل التسليم وإرساله للأرشيف...')]
      });

      try {
        const attachments = Array.from(msg.attachments.values());
        
        const logChannelId = '1486132662753034280';
        const logChannel = await context.guild.channels.fetch(logChannelId).catch(() => null);
        
        let permanentUrls: string[] = [];

        if (isGuildTextChannelType(logChannel)) {
          const logEmbed = new EmbedBuilder()
            .setColor(hexToDecimal(this.config.bot.successColor))
            .setTitle('📦 دليل تسليم جديد (Proof of Delivery)')
            .addFields(
              { name: 'التذكرة', value: `#${ticket.channel_name || 'غير معروف'}`, inline: true },
              { name: 'رقم التذكرة', value: `#${padTicketNumber(ticket.ticket_number, this.config.naming.zeroPadLength)}`, inline: true },
              { name: 'الوسيط', value: `<@${interaction.user.id}> (\`${interaction.user.id}\`)`, inline: true },
              { name: 'العميل', value: `<@${ticket.creator_id}> (\`${ticket.creator_id}\`)`, inline: true },
              { name: 'وقت الرفع', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: false }
            )
            .setTimestamp();

          const logMsg = await logChannel.send({
            embeds: [logEmbed],
            files: attachments.map(att => att.url)
          });
          permanentUrls = logMsg.attachments.map(att => att.url);
        } else {
          logger.error('Proof of Delivery log channel 1486132662753034280 not found.');
          permanentUrls = attachments.map(att => att.url);
        }

        const mediatorLogChannelId = this.config.guild.mediatorLogChannelId;
        if (mediatorLogChannelId && mediatorLogChannelId !== logChannelId) {
          const medLogChannel = await context.guild.channels.fetch(mediatorLogChannelId).catch(() => null);
          if (isGuildTextChannelType(medLogChannel)) {
            const medLogEmbed = new EmbedBuilder()
              .setColor(hexToDecimal(this.config.bot.successColor))
              .setTitle('📦 دليل تسليم وسيط')
              .addFields(
                { name: 'التذكرة', value: `#${ticket.channel_name || 'غير معروف'}`, inline: true },
                { name: 'الوسيط', value: `<@${interaction.user.id}>`, inline: true },
                { name: 'العميل', value: `<@${ticket.creator_id}>`, inline: true }
              )
              .setTimestamp();

            await medLogChannel.send({
              embeds: [medLogEmbed],
              files: attachments.map(att => att.url)
            }).catch(() => null);
          }
        }

        await msg.delete().catch(() => null);

        const currentMetadata = (ticket.metadata as Record<string, any>) || {};
        const deliveryProofs = currentMetadata.delivery_proofs || [];

        const newProof = {
          uploaded_by: interaction.user.id,
          uploaded_by_tag: interaction.user.tag,
          uploaded_at: new Date().toISOString(),
          original_message_id: msg.id,
          files: attachments.map((att, index) => ({
            name: att.name,
            original_url: att.url,
            permanent_url: permanentUrls[index] || att.url,
            size: att.size,
            contentType: att.contentType
          }))
        };

        deliveryProofs.push(newProof);

        await this.ticketRepository.updateMetadata(ticket.channel_id!, {
          ...currentMetadata,
          delivery_proofs: deliveryProofs
        });

        await processingMsg.delete().catch(() => null);

        await context.channel.send({
          embeds: [
            buildSuccessEmbed(
              this.config,
              '✅ تم حفظ دليل التسليم بنجاح',
              `تم حفظ وأرشفة ملف دليل التسليم المقدم من الوسيط <@${interaction.user.id}> بشكل دائم في السجلات وقاعدة البيانات.`
            )
          ]
        });

      } catch (err: any) {
        logger.error('Error processing proof of delivery', err);
        await processingMsg.delete().catch(() => null);
        await context.channel.send({
          embeds: [buildErrorEmbed(this.config, `❌ تعذر حفظ دليل التسليم: ${err.message}`)]
        }).catch(() => null);
      }
    });

    collector.on('end', async (_, reason) => {
      if (!collected && reason !== 'messageDelete') {
        await context.channel.send({
          content: `<@${interaction.user.id}> ⚠️ انتهى الوقت المخصص لرفع دليل التسليم (60 ثانية) دون إرفاق أي ملف.`
        }).catch(() => null);
      }
    });
  }

  public async handleSlashClose(interaction: ChatInputCommandInteraction, reason: string): Promise<void> {
    const channelId = interaction.channelId;
    if (!channelId || !interaction.guild) {
      await safeEditReply(interaction, [buildErrorEmbed(this.config, this.config.ticket.messages.notInTicket)]);
      return;
    }

    const ticket = await this.ticketRepository.findByChannelId(channelId);
    if (!ticket || !ticket.channel_id) {
      await safeEditReply(interaction, [buildErrorEmbed(this.config, this.config.ticket.messages.notInTicket)]);
      return;
    }

    const channel = await interaction.guild.channels.fetch(ticket.channel_id).catch(() => null);
    if (!isGuildTextChannelType(channel) || channel.type !== ChannelType.GuildText) {
      await safeEditReply(interaction, [buildErrorEmbed(this.config, 'لم يتم العثور على قناة التذكرة.')]);
      return;
    }

    const member = interaction.member as GuildMember;
    const isCreator = ticket.creator_id === interaction.user.id;
    const isManager = canManageTicket(member, this.config);

    if (!isCreator && !isManager) {
      await safeEditReply(interaction, [buildErrorEmbed(this.config, this.config.ticket.messages.noPermission)]);
      return;
    }

    try {
      const closedTicket = await this.ticketRepository.closeByChannel(channel.id, {
        closed_by: interaction.user.id,
        closed_by_tag: interaction.user.tag,
        close_reason: reason,
      });

      await this.incrementCompletedTicket(closedTicket).catch(() => null);

      await this.sendCustomCloseLog(interaction.guild, closedTicket, interaction.user.id, channel).catch((error) => {
        logger.error('Failed to send custom close log', error);
      });

      await this.sendTranscript(interaction.guild, closedTicket, channel).catch((error) => {
        logger.warn('Failed to generate transcript', error instanceof Error ? error.message : error);
      });

      const archivedName = normalizeChannelName(
        `closed-${padTicketNumber(closedTicket.ticket_number, this.config.naming.zeroPadLength)}`,
        this.config.naming.maxChannelNameLength,
      );

      await channel.setName(archivedName).catch(() => null);
      await channel.setParent(this.config.guild.archiveCategoryId).catch(() => null);
      await channel.permissionOverwrites.edit(ticket.creator_id, {
        ViewChannel: false,
        SendMessages: false,
      }).catch(() => null);

      for (const participantId of ticket.participant_ids) {
        await channel.permissionOverwrites.edit(participantId, {
          ViewChannel: false,
          SendMessages: false,
        }).catch(() => null);
      }

      await channel.send({
        embeds: [buildSuccessEmbed(this.config, 'Ticket Closed', `${this.config.ticket.messages.closed}\nClosed by ${interaction.user}.\nReason: ${reason}`)],
      }).catch(() => null);

      await this.sendLog(interaction.guild, this.buildCloseLogEmbed(closedTicket, interaction.user.id, archivedName));

      await safeEditReply(interaction, [buildSuccessEmbed(this.config, 'تم', `${this.config.ticket.messages.closed}`)]);
    } catch (error) {
      logger.error('Failed to close ticket via command', error instanceof Error ? error.message : error);
      await safeEditReply(interaction, [buildErrorEmbed(this.config, 'تعذر إغلاق التذكرة حالياً.')]);
    }
  }

  public async handleSlashStats(interaction: ChatInputCommandInteraction): Promise<void> {
    try {
      const guildId = this.config.guild.id;
      const stats = await this.ticketRepository.getStats(guildId);

      const embed = new EmbedBuilder()
        .setColor(hexToDecimal(this.config.bot.embedColor))
        .setTitle('إحصائيات التذاكر')
        .addFields(
          { name: 'التذاكر المفتوحة', value: `${stats.open}`, inline: true },
          { name: 'التذاكر المغلقة', value: `${stats.closed}`, inline: true },
          { name: 'إجمالي التذاكر', value: `${stats.total}`, inline: true },
        )
        .setFooter({ text: this.config.bot.footerText })
        .setTimestamp();

      await safeEditReply(interaction, [embed]);
    } catch (error) {
      logger.error('Failed to fetch stats', error instanceof Error ? error.message : error);
      await safeEditReply(interaction, [buildErrorEmbed(this.config, 'تعذر جلب الإحصائيات.')]);
    }
  }

  private buildWaitRoomEmbed(member: GuildMember): EmbedBuilder {
    return new EmbedBuilder()
      .setColor(hexToDecimal(this.config.bot.embedColor))
      .setTitle('🛡️ اتفاقية الاستخدام ونظام الوساطة الآمنة')
      .setDescription(
        `أهلاً بك يا ${member} في نظام التحقق والوساطة المعتمد.\n\n` +
        `⚠️ **تنبيه هام جداً**:\n` +
        `**تذكرتك الآن في وضع الانتظار المؤقت (غير نشطة ولا يراها الوسطاء).** لكي يتم تفعيل تذكرتك ونقلها إلى الوسيط المناسب، يجب عليك إكمال الخطوات التالية بالضغط على الأزرار الموضحة في الأسفل:\n\n` +
        `1️⃣ اضغط أولاً على زر **كتابة التريد في حدود كم دولار $** لتحديد قيمة الصفقة بدقة.\n` +
        `2️⃣ بعد حفظ قيمة التريد بنجاح، اضغط على زر **تم قراءة الشروط وموافق على الشروط والأحكام**.\n` +
        `3️⃣ اضغط على زر **التأكيد النهائي** الذي سيظهر لك، وسيتم تفعيل التذكرة فوراً ونقلها للوسيط المناسب وحذف هذه الغرفة المؤقتة.`
      )
      .setThumbnail(this.config.images.thumbnailUrl || null)
      .addFields(
        {
          name: '🤖 كيف يعمل نظام الفرز والتوجيه الذكي؟',
          value:
            'لتوفير أقصى درجات الأمان وحماية المبادلات، يقوم النظام بفحص قيمة تداولك وتوجيهك كالتالي:\n\n' +
            '• **إذا كانت قيمة التريد 40$ أو أقل**:\n' +
            '  يتم توجيهك إلى **[وسيط جديد]**؛ وذلك لأن الصفقات الصغيرة تعتبر منخفضة الخطورة نسبياً، مما يتيح للوسطاء الجدد فرصة اكتساب الخبرة العملية وبناء سمعتهم دون استلام مبادلات ضخمة.\n\n' +
            '• **إذا كانت قيمة التريد أعلى من 40$**:\n' +
            '  يتم توجيهك مباشرة إلى **[وسيط مضمون]**؛ وذلك لأن الصفقات ذات المبالغ العالية تتطلب خبرة متقدمة وأماناً إضافياً لضمان سير العملية بسلاسة وتقليل احتمالية حدوث أي مشاكل أو محاولات سرقة.'
        },
        {
          name: '📜 قوانين التبادل العامة',
          value:
            '• يمنع تماماً التعامل مع أي وسيط خارج قنوات التذاكر الرسمية.\n' +
            '• يمنع إرسال أي روابط خارجية أو دعوات لسيرفرات أخرى داخل التذكرة.\n' +
            '• يجب الالتزام بتوجيهات الوسيط حرفياً لضمان سلامة التبادل.'
        },
        {
          name: '💸 شروط الضمان ونظام التعويض',
          value:
            '• **مسؤولية التعويض**: تقع مسؤولية التعويض عن أي سرقة قد تحدث من وسيط جديد حصراً على:\n' +
            '  1. الأعضاء الحاملين لرتبة التعويض (<@&1507646852869259325>).\n' +
            '  2. أو الشخص (الإداري) الذي قام بتزكية وإدخال هذا الوسيط الجديد إلى النظام.\n' +
            '• **نوع التعويض**: التعويض **ليس أموالاً حقيقية نهائياً**، بل يتمثل في أغراض داخل اللعبة / Brainrot (أو غرض مشابه أو أقوى قليلاً).\n' +
            '• **أغراض خارجة عن التعويض**: لا يوجد تعويض نهائياً على **الشخصيات، المابات، الأغراض النادرة جداً، أو أي غرض يصعب تعويضه أو توفيره**.'
        },
        {
          name: '⚠️ تنبيه هام وإخلاء مسؤولية (يرجى القراءة بعناية)',
          value:
            '> **في حال قام العميل بكتابة قيمة تريد خاطئة أو أقل من القيمة الحقيقية للسلعة وتمت السرقة، فإن الإدارة غير مسؤولة نهائياً عن أي خسارة أو تعويض.**\n' +
            '> \n' +
            '> **بمجرد الضغط على زر الموافقة، فهذا يعتبر إقراراً بالاطلاع وموافقة كاملة على جميع الشروط والأحكام وتحمل كامل للمسؤولية.**'
        },
        {
          name: '⚙️ الخطوات المطلوبة لإكمال فتح التذكرة',
          value:
            '1️⃣ اضغط على زر **كتابة التريد في حدود كم دولار $** وحدد القيمة بدقة بالدولار.\n' +
            '2️⃣ اضغط على زر **تم قراءة الشروط وموافق على الشروط والأحكام** لتأكيد موافقتك.\n' +
            '3️⃣ سيظهر لك زر تأكيد أخير، بالضغط عليه سيتم توجيهك فوراً للوسيط المناسب وحذف هذه الغرفة المؤقتة.'
        }
      )
      .setFooter({
        text: 'بوابة الأمان والوساطة المعتمدة • Steal the Brainrot',
        iconURL: this.config.bot.footerIconUrl || undefined
      })
      .setTimestamp();
  }

  private async processWaitRoomCreation(
    interaction: StringSelectMenuInteraction,
    category: TicketCategoryConfig
  ): Promise<void> {
    if (!interaction.inCachedGuild()) return;

    const userId = interaction.user.id;
    if (this.activeCreations.has(userId)) {
      logger.info(`[instance=${this.instanceId}] [WAIT_ROOM_CREATE_REJECTED] Creator ${userId} is already in active creations.`);
      await safeReply(interaction, [buildErrorEmbed(this.config, '⚠️ يرجى الانتظار، يتم حالياً إنشاء تذكرتك...')]);
      return;
    }
    this.activeCreations.add(userId);
    logger.info(`[instance=${this.instanceId}] [WAIT_ROOM_CREATE_START] Creator: ${userId}`);

    try {
      if (!(await safeDeferReply(interaction, `open-wait:${category.key}`))) {
        return;
      }

      const existing = await this.findExistingOpenTicket(interaction.guildId, interaction.user.id);
      if (existing?.channel_id) {
        const existingChannel = await interaction.guild.channels.fetch(existing.channel_id).catch(() => null);
        if (!existingChannel) {
          await this.ticketRepository.closeByChannel(existing.channel_id, {
            closed_by: interaction.user.id,
            closed_by_tag: interaction.user.tag,
            close_reason: 'Auto-closed: channel no longer exists',
          }).catch(() => null);
          logger.info(`Auto-closed stale ticket #${existing.ticket_number} (channel deleted)`);
        } else {
          await safeEditReply(interaction, [buildAlreadyOpenEmbed(this.config, existing.channel_id)]);
          return;
        }
      }

      let createdChannel: TextChannel | null = null;
      let createdTicket: TicketRecord | null = null;

      try {
        const ticketNumber = await this.ticketRepository.nextTicketNumber();
        const paddedNumber = padTicketNumber(ticketNumber, 3);
        const channelName = `اكمال-الشروط-${paddedNumber}`;
        
        const waitCategoryId = '1486147476011352307';
        
        const permissionOverwrites = [
          {
            id: interaction.guild.roles.everyone.id,
            deny: [PermissionFlagsBits.ViewChannel],
          },
          {
            id: interaction.user.id,
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.SendMessages,
              PermissionFlagsBits.ReadMessageHistory,
              PermissionFlagsBits.AttachFiles,
              PermissionFlagsBits.EmbedLinks,
            ],
          },
        ];
        
        const botMemberId = interaction.guild.members.me?.id;
        if (botMemberId) {
          permissionOverwrites.push({
            id: botMemberId,
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.SendMessages,
              PermissionFlagsBits.ReadMessageHistory,
              PermissionFlagsBits.AttachFiles,
              PermissionFlagsBits.EmbedLinks,
              PermissionFlagsBits.ManageChannels,
              PermissionFlagsBits.ManageMessages,
            ],
          });
        }

        const staffRoleIds = uniqueStrings([
          ...this.config.guild.supportRoleIds,
          ...this.config.guild.managerRoleIds,
        ]);
        for (const roleId of staffRoleIds) {
          if (interaction.guild.roles.cache.has(roleId)) {
            permissionOverwrites.push({
              id: roleId,
              allow: [
                PermissionFlagsBits.ViewChannel,
                PermissionFlagsBits.SendMessages,
                PermissionFlagsBits.ReadMessageHistory,
              ],
            });
          }
        }

        const created = await interaction.guild.channels.create({
          name: channelName,
          type: ChannelType.GuildText,
          parent: waitCategoryId,
          topic: `Wait Room for Ticket #${ticketNumber} | User: ${interaction.user.tag} (${interaction.user.id})`,
          permissionOverwrites,
        });

        if (!isGuildTextChannelType(created) || created.type !== ChannelType.GuildText) {
          throw new Error('Created wait channel is not a guild text channel.');
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
          answers: [],
          metadata: {
            wait_room: true,
            trade_value: null,
            agreed: false,
            openedByAvatarUrl: interaction.user.displayAvatarURL(),
          },
        });

        const embed = this.buildWaitRoomEmbed(interaction.member as GuildMember);
        
        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId('wait:btn:agree')
            .setLabel('تم قراءة الشروط وموافق على الشروط والأحكام')
            .setStyle(ButtonStyle.Success),
          new ButtonBuilder()
            .setCustomId('wait:btn:trade_value')
            .setLabel('كتابة التريد في حدود كم دولار $')
            .setStyle(ButtonStyle.Primary),
          new ButtonBuilder()
            .setCustomId('wait:btn:close')
            .setLabel('🔒 إغلاق التذكرة')
            .setStyle(ButtonStyle.Danger)
        );

        await created.send({
          content: `${interaction.user}`,
          embeds: [embed],
          components: [row],
        });

        const logChannelId = '1486132662753034280';
        const logChannel = await interaction.guild.channels.fetch(logChannelId).catch(() => null);
        if (isGuildTextChannelType(logChannel)) {
          const logEmbed = buildSuccessEmbed(this.config, 'Wait Room Created', `تم إنشاء غرفة انتظار جديدة <#${created.id}>.`)
            .addFields(
              { name: 'رقم التذكرة', value: `#${ticketNumber}`, inline: true },
              { name: 'صاحب الطلب', value: `${interaction.user} (${interaction.user.id})`, inline: true },
              { name: 'نوع الطلب', value: category.label, inline: true }
            );
          await logChannel.send({ embeds: [logEmbed] }).catch(() => null);
        }

        await safeEditReply(interaction, [buildSuccessEmbed(this.config, 'تم إنشاء غرفة الانتظار', `يرجى التوجه إلى <#${created.id}> لإكمال الخطوات والموافقة على الشروط.`)]);
      } catch (error) {
        logger.error('Failed to open wait room', error instanceof Error ? error.message : error);

        if (createdTicket) {
          await this.ticketRepository.deleteTicketById(createdTicket.id).catch(() => null);
        }

        if (createdChannel) {
          await createdChannel.delete().catch(() => null);
        }

        await safeEditReply(interaction, [buildErrorEmbed(this.config, 'حدث خطأ أثناء إنشاء غرفة الانتظار.')]);
      }
    } finally {
      this.activeCreations.delete(userId);
      logger.info(`[instance=${this.instanceId}] [WAIT_ROOM_CREATE_END] Creator: ${userId}`);
    }
  }

  public async handleWaitButton(interaction: ButtonInteraction): Promise<void> {
    if (!interaction.inCachedGuild()) return;

    const channelId = interaction.channelId;
    const ticket = await this.ticketRepository.findByChannelId(channelId);
    if (!ticket || !(ticket.metadata as any)?.wait_room) {
      await safeReply(interaction, [buildErrorEmbed(this.config, '❌ تم تفعيل هذه التذكرة أو إغلاقها بالفعل.')]);
      return;
    }

    const isManager = canManageTicket(interaction.member as GuildMember, this.config);
    const isCreator = interaction.user.id === ticket.creator_id;

    if (!isCreator && !isManager) {
      await interaction.reply({
        content: '❌ ليس لديك الصلاحية لاستخدام هذه الأزرار.',
        flags: MessageFlags.Ephemeral
      }).catch(() => null);
      return;
    }

    if (interaction.customId !== 'wait:btn:close' && !isCreator) {
      await interaction.reply({
        content: '❌ هذا الإجراء مخصص فقط لصاحب التذكرة.',
        flags: MessageFlags.Ephemeral
      }).catch(() => null);
      return;
    }

    if (interaction.customId === 'wait:btn:close') {
      if (!(await safeDeferReply(interaction, 'wait_close_defer'))) {
        return;
      }
      await this.handleCloseTicket(interaction);
      return;
    }

    if (interaction.customId === 'wait:btn:trade_value') {
      const modal = new ModalBuilder()
        .setCustomId('wait:modal:trade_value')
        .setTitle('تحديد قيمة التريد بالدولار');

      const input = new TextInputBuilder()
        .setCustomId('trade_value_input')
        .setLabel('قيمة التريد بالدولار ($)')
        .setPlaceholder('مثال: 50 (اكتب الرقم فقط بالدولار)')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setMinLength(1)
        .setMaxLength(10);

      const row = new ActionRowBuilder<TextInputBuilder>().addComponents(input);
      modal.addComponents(row);

      await safeShowModal(interaction, modal, 'wait:modal:trade_value');
      return;
    }

    if (interaction.customId === 'wait:btn:agree') {
      await safeDeferReply(interaction, 'wait_agree_defer');
      
      const confirmEmbed = new EmbedBuilder()
        .setColor(hexToDecimal(this.config.bot.embedColor))
        .setTitle('⚠️ تأكيد نهائي لقراءة الشروط والقوانين')
        .setDescription(
          `**هل أنت متأكد أنك قرأت جميع الشروط والقوانين وفهمت نظام التعويض بالكامل؟**\n\n` +
          `*تنبيه: أي خطأ في تحديد قيمة التريد يخلي مسؤولية الإدارة تماماً.*`
        )
        .setTimestamp();

      const confirmRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId('wait:btn:final_confirm')
          .setLabel('✅ تم قراءة الشروط والموافقة عليها')
          .setStyle(ButtonStyle.Success)
      );

      await interaction.channel?.send({
        content: `${interaction.user}`,
        embeds: [confirmEmbed],
        components: [confirmRow]
      }).catch(() => null);

      await safeEditReply(interaction, [buildSuccessEmbed(this.config, 'تأكيد الموافقة', 'تم إرسال رسالة التأكيد الإضافية أدناه. يرجى الضغط على زر التأكيد النهائي.')]);
      return;
    }

    if (interaction.customId === 'wait:btn:final_confirm') {
      const tradeValue = (ticket.metadata as any)?.trade_value;
      if (tradeValue === undefined || tradeValue === null) {
        await safeReply(interaction, [buildErrorEmbed(this.config, '⚠️ يرجى تحديد قيمة التريد أولاً بالضغط على زر "كتابة التريد في حدود كم دولار $".')]);
        return;
      }

      if (this.activeTransitions.has(ticket.id) || (ticket.metadata as any)?.transitioning) {
        logger.info(`[instance=${this.instanceId}] [TRANSITION_REJECTED] Ticket ${ticket.id} is already transitioning.`);
        await safeReply(interaction, [buildErrorEmbed(this.config, '⚠️ جاري معالجة تفعيل التذكرة بالفعل، يرجى الانتظار...')]);
        return;
      }
      this.activeTransitions.add(ticket.id);
      logger.info(`[instance=${this.instanceId}] [TRANSITION_LOCK_ACQUIRED] Ticket: ${ticket.id}`);

      try {
        const disabledRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId('wait:btn:final_confirm')
            .setLabel('⏳ جاري التفعيل...')
            .setStyle(ButtonStyle.Success)
            .setDisabled(true)
        );
        await interaction.message.edit({ components: [disabledRow] }).catch(() => null);
      } catch (err) {
        logger.error('Failed to disable final confirm button', err);
      }

      if (!(await safeDeferReply(interaction, 'wait_final_confirm_defer'))) {
        this.activeTransitions.delete(ticket.id);
        return;
      }

      try {
        await this.transitionWaitRoomToTicket(interaction, ticket, Number(tradeValue));
      } finally {
        this.activeTransitions.delete(ticket.id);
      }
    }
  }

  public async handleWaitTradeValueModal(interaction: ModalSubmitInteraction): Promise<void> {
    if (!interaction.inCachedGuild()) return;
    await safeDeferReply(interaction, 'wait_modal_defer');

    const channelId = interaction.channelId;
    if (!channelId) return;

    const ticket = await this.ticketRepository.findByChannelId(channelId);
    if (!ticket) {
      await safeEditReply(interaction, [buildErrorEmbed(this.config, 'تعذر العثور على بيانات التذكرة.')]);
      return;
    }

    if (interaction.user.id !== ticket.creator_id) {
      await safeEditReply(interaction, [buildErrorEmbed(this.config, '❌ ليس لديك الصلاحية لتنفيذ هذا الإجراء.')]);
      return;
    }

    const rawInput = interaction.fields.getTextInputValue('trade_value_input');
    const parsedAmount = await parseTradeAmountSmartly(rawInput);

    if (parsedAmount === null || isNaN(parsedAmount) || parsedAmount <= 0) {
      await safeEditReply(interaction, [buildErrorEmbed(this.config, '❌ يرجى إدخال رقم صحيح ومناسب لقيمة التريد بالدولار (مثال: 50).')]);
      return;
    }

    const updatedMetadata = {
      ...(ticket.metadata as Record<string, any>),
      trade_value: parsedAmount,
      trade_value_raw: rawInput,
    };

    await this.ticketRepository.updateMetadata(ticket.channel_id!, updatedMetadata);

    await interaction.channel?.send({
      embeds: [buildSuccessEmbed(this.config, 'تم تحديث قيمة التريد', `✅ تم حفظ قيمة التريد بنجاح: **$${parsedAmount}**`)]
    }).catch(() => null);

    await safeEditReply(interaction, [buildSuccessEmbed(this.config, 'تم الحفظ', `✅ تم حفظ قيمة التريد بنجاح: **$${parsedAmount}**`)]);
  }

  private async transitionWaitRoomToTicket(
    interaction: ButtonInteraction,
    ticket: TicketRecord,
    tradeValue: number
  ): Promise<void> {
    const guild = interaction.guild!;
    const oldChannel = interaction.channel as TextChannel;
    
    // Acquire database lock first
    const lockAcquired = await this.ticketRepository.acquireTransitionLock(ticket.id, ticket.metadata);
    if (!lockAcquired) {
      logger.info(`[instance=${this.instanceId}] [TRANSITION_DB_LOCK_FAILED] Ticket: ${ticket.id}`);
      await safeEditReply(interaction, [buildErrorEmbed(this.config, '⚠️ جاري معالجة تفعيل هذه التذكرة بالفعل في نافذة أخرى.')]);
      return;
    }
    logger.info(`[instance=${this.instanceId}] [TRANSITION_DB_LOCK_ACQUIRED] Ticket: ${ticket.id}`);

    const mediatorRoleId = MIDDLEMAN_ROLE_ID;
    const mediatorRoleName = MIDDLEMAN_ROLE_NAME;
    const mediatorLabel = MIDDLEMAN_LABEL;
    
    const paddedNumber = padTicketNumber(ticket.ticket_number, this.config.naming.zeroPadLength);
    const channelName = `وسيط-مضمون-${paddedNumber}`;
    
    let createdChannel: TextChannel | null = null;

    try {
      const permissionOverwrites = [
        {
          id: guild.roles.everyone.id,
          deny: [PermissionFlagsBits.ViewChannel],
        },
        {
          id: ticket.creator_id,
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
        {
          id: mediatorRoleId,
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
        }
      ];
      
      const botMemberId = guild.members.me?.id;
      if (botMemberId) {
        permissionOverwrites.push({
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
        });
      }

      const managerRoleIds = this.config.guild.managerRoleIds;
      for (const roleId of managerRoleIds) {
        if (guild.roles.cache.has(roleId)) {
          permissionOverwrites.push({
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
          });
        }
      }

      const mainCategoryId = this.config.guild.categoryId;
      const created = await guild.channels.create({
        name: channelName,
        type: ChannelType.GuildText,
        parent: mainCategoryId,
        topic: `Ticket #${ticket.ticket_number} | Mediator: ${mediatorRoleName} | User: ${ticket.creator_tag} (${ticket.creator_id})`,
        permissionOverwrites,
      });

      if (!isGuildTextChannelType(created) || created.type !== ChannelType.GuildText) {
        throw new Error('Created channel is not a guild text channel.');
      }

      createdChannel = created;

      const answers = [
        {
          key: 'trade_amount',
          label: 'قيمة التريد بالدولار ($)',
          value: `$${tradeValue}`,
        }
      ];

      const updatedMetadata = {
        ...(ticket.metadata as Record<string, any>),
        wait_room: false,
        trade_value: tradeValue,
        mediator_role_id: mediatorRoleId,
        mediator_role_name: mediatorRoleName,
      };
      delete (updatedMetadata as any).transitioning;
      delete (updatedMetadata as any).transitioned_at;

      const updatedTicket = await this.ticketRepository.updateChannelInfo(
        ticket.channel_id!,
        created.id,
        created.name,
        answers,
        updatedMetadata
      );

      const welcomeEmbeds = await buildTicketEmbeds(guild, this.config, updatedTicket);
      const sentMessage = await created.send({
        content: `<@${ticket.creator_id}> <@&${mediatorRoleId}>`.trim(),
        embeds: welcomeEmbeds,
        components: buildTicketActionRows(this.config),
        allowedMentions: {
          users: [ticket.creator_id],
          roles: [mediatorRoleId],
        },
      });

      if (this.config.limits.pinSummaryMessageOnCreate) {
        await sentMessage.pin().catch(() => null);
      }

      await oldChannel.send({
        content: `🔔 **تم إنشاء التذكرة الأساسية بنجاح:** <#${created.id}>\nسيتم حذف هذه القناة المؤقتة تلقائياً خلال 5 ثوانٍ.`
      }).catch(() => null);

      setTimeout(() => {
        oldChannel.delete().catch(() => null);
      }, 5000);

      await this.sendCustomOpenLog(guild, updatedTicket, created.id, tradeValue, mediatorRoleName, mediatorLabel);

      await safeEditReply(interaction, [buildSuccessEmbed(this.config, 'تم تفعيل التذكرة', `تم فتح التذكرة بنجاح في القناة: <#${created.id}>`)]);
    } catch (error) {
      logger.error('Failed to transition wait room to ticket', error instanceof Error ? error.message : error);
      
      // Cleanup created Discord channel if database update failed
      if (createdChannel) {
        await createdChannel.delete().catch(() => null);
      }

      // Release DB lock so user can try again
      await this.ticketRepository.releaseTransitionLock(ticket.id, ticket.metadata).catch(() => null);

      await safeEditReply(interaction, [buildErrorEmbed(this.config, 'حدث خطأ أثناء تفعيل التذكرة. يرجى مراجعة الإدارة.')]);
    }
  }

  private async sendCustomOpenLog(
    guild: Guild,
    ticket: TicketRecord,
    channelId: string,
    tradeValue: number,
    mediatorRoleName: string,
    mediatorLabel: string
  ): Promise<void> {
    const logChannelId = '1486132662753034280';
    const logChannel = await guild.channels.fetch(logChannelId).catch(() => null);
    if (!isGuildTextChannelType(logChannel)) return;

    const embed = new EmbedBuilder()
      .setColor(hexToDecimal(this.config.bot.successColor))
      .setTitle('📥 تذكرة وساطة جديدة')
      .addFields(
        { name: 'اسم التذكرة', value: `#${ticket.channel_name || 'غير معروف'}`, inline: true },
        { name: 'رقم التذكرة', value: `#${padTicketNumber(ticket.ticket_number, this.config.naming.zeroPadLength)}`, inline: true },
        { name: 'اسم العميل', value: `<@${ticket.creator_id}>`, inline: true },
        { name: 'آيدي العميل', value: `\`${ticket.creator_id}\``, inline: true },
        { name: 'قيمة التريد', value: `**$${tradeValue}**`, inline: true },
        { name: 'نوع الوسيط المطلوبة', value: mediatorRoleName, inline: true },
        { name: 'حالة الاستلام', value: '❌ لم تستلم بعد', inline: true },
        { name: 'هل التريد جديد أو مضمون', value: mediatorLabel, inline: true },
        { name: 'وقت فتح تذكرة الانتظار', value: `<t:${Math.floor(new Date(ticket.opened_at).getTime() / 1000)}:F>`, inline: false }
      )
      .setTimestamp();

    await logChannel.send({ embeds: [embed] }).catch(() => null);
  }

  private async sendCustomClaimLog(
    guild: Guild,
    ticket: TicketRecord,
    claimerId: string | null,
  ): Promise<void> {
    const logChannelId = '1486132662753034280';
    const logChannel = await guild.channels.fetch(logChannelId).catch(() => null);
    if (!isGuildTextChannelType(logChannel)) return;

    const tradeValue = (ticket.metadata as any)?.trade_value ?? 'غير محدد';
    const mediatorRoleName = (ticket.metadata as any)?.mediator_role_name ?? MIDDLEMAN_ROLE_NAME;
    const mediatorLabel = MIDDLEMAN_LABEL;

    const embed = new EmbedBuilder()
      .setColor(hexToDecimal(this.config.bot.successColor))
      .setTitle(claimerId ? '🤝 تم استلام التذكرة' : '🔓 تم إلغاء استلام التذكرة')
      .addFields(
        { name: 'اسم التذكرة', value: `#${ticket.channel_name || 'غير معروف'}`, inline: true },
        { name: 'رقم التذكرة', value: `#${padTicketNumber(ticket.ticket_number, this.config.naming.zeroPadLength)}`, inline: true },
        { name: 'اسم العميل', value: `<@${ticket.creator_id}>`, inline: true },
        { name: 'آيدي العميل', value: `\`${ticket.creator_id}\``, inline: true },
        { name: 'قيمة التريد', value: typeof tradeValue === 'number' ? `**$${tradeValue}**` : String(tradeValue), inline: true },
        { name: 'نوع الوسيط', value: mediatorRoleName, inline: true },
        { name: 'من استلم التذكرة', value: claimerId ? `<@${claimerId}>` : 'غير مستلمة', inline: true },
        { name: 'هل التريد جديد أو مضمون', value: mediatorLabel, inline: true },
        { name: 'نوع الوسيط المستخدم', value: mediatorRoleName, inline: true },
        { name: 'وقت فتح التذكرة', value: `<t:${Math.floor(new Date(ticket.opened_at).getTime() / 1000)}:F>`, inline: false }
      );

    if (claimerId) {
      embed.addFields({ name: 'وقت الاستلام', value: `<t:${Math.floor(Date.now() / 1000)}:R>`, inline: false });
    }

    await logChannel.send({ embeds: [embed] }).catch(() => null);
  }

  private async sendCustomCloseLog(
    guild: Guild,
    ticket: TicketRecord,
    closedById: string,
    channel: TextChannel
  ): Promise<void> {
    const logChannelId = '1486132662753034280';
    const logChannel = await guild.channels.fetch(logChannelId).catch(() => null);
    if (!isGuildTextChannelType(logChannel)) return;

    const attachment = await this.transcriptService.buildAttachment(
      channel,
      ticket,
      this.config.naming.zeroPadLength,
    ).catch(() => null);

    const openedTime = new Date(ticket.opened_at).getTime();
    const closedTime = Date.now();
    const durationMs = closedTime - openedTime;
    
    const formatDuration = (ms: number): string => {
      const seconds = Math.floor((ms / 1000) % 60);
      const minutes = Math.floor((ms / (1000 * 60)) % 60);
      const hours = Math.floor((ms / (1000 * 60 * 60)) % 24);
      const days = Math.floor(ms / (1000 * 60 * 60 * 24));
      
      const parts: string[] = [];
      if (days > 0) parts.push(`${days} يوم`);
      if (hours > 0) parts.push(`${hours} ساعة`);
      if (minutes > 0) parts.push(`${minutes} دقيقة`);
      if (seconds > 0 || parts.length === 0) parts.push(`${seconds} ثانية`);
      return parts.join(' و ');
    };

    const durationText = formatDuration(durationMs);
    const tradeValue = (ticket.metadata as any)?.trade_value ?? 'غير محدد';
    const mediatorRoleName = (ticket.metadata as any)?.mediator_role_name ?? MIDDLEMAN_ROLE_NAME;

    const embed = new EmbedBuilder()
      .setColor(hexToDecimal(this.config.bot.errorColor))
      .setTitle('🔒 تم إغلاق التذكرة وأرشفة المحادثة')
      .addFields(
        { name: 'اسم التذكرة المؤرشفة', value: `#${ticket.channel_name || 'غير معروف'}`, inline: true },
        { name: 'رقم التذكرة', value: `#${padTicketNumber(ticket.ticket_number, this.config.naming.zeroPadLength)}`, inline: true },
        { name: 'صاحب التذكرة (العميل)', value: `<@${ticket.creator_id}>`, inline: true },
        { name: 'آيدي العميل', value: `\`${ticket.creator_id}\``, inline: true },
        { name: 'من استلم التذكرة', value: ticket.claimed_by ? `<@${ticket.claimed_by}>` : 'لم يتم الاستلام', inline: true },
        { name: 'من أغلق التذكرة', value: `<@${closedById}>`, inline: true },
        { name: 'قيمة التريد', value: typeof tradeValue === 'number' ? `**$${tradeValue}**` : String(tradeValue), inline: true },
        { name: 'نوع الوسيط', value: mediatorRoleName, inline: true },
        { name: 'وقت الفتح', value: `<t:${Math.floor(openedTime / 1000)}:F>`, inline: false },
        { name: 'وقت الإغلاق', value: `<t:${Math.floor(closedTime / 1000)}:F>`, inline: false },
        { name: 'مدة التذكرة', value: durationText, inline: false }
      )
      .setTimestamp();

    const files = attachment ? [attachment] : [];
    await logChannel.send({ embeds: [embed], files }).catch((err) => {
      logger.error('Failed to send close log to channel', err);
    });
  }

  // ============================================================
  // ADMIN CONTROL PANEL LOGIC
  // ============================================================

  public async sendControlPanel(interaction: ChatInputCommandInteraction | ButtonInteraction): Promise<void> {
    if (!isAuthorizedAdmin(interaction.user.id)) {
      await safeReply(interaction, [buildErrorEmbed(this.config, '❌ ليس لديك الصلاحية لتشغيل لوحة التحكم.')]);
      return;
    }

    const embed = new EmbedBuilder()
      .setColor(hexToDecimal(this.config.bot.embedColor))
      .setTitle('🛠️ لوحة التحكم الكاملة بالتذاكر (Control Panel)')
      .setDescription(
        `مرحباً بك في لوحة التحكم بنظام التذاكر.\n` +
        `يمكنك تنفيذ العمليات التالية للتحكم بالتذاكر وقنوات الانتظار الحالية:`
      )
      .addFields(
        { name: '🔴 غرف الانتظار القديمة', value: 'حذف جميع الغرف المؤقتة القديمة التي تبدأ بـ `wait-` أو `اكمال-الشروط-`.', inline: false },
        { name: '🔵 التذاكر النشطة', value: 'حذف جميع قنوات التذاكر الأساسية المفتوحة.', inline: false },
        { name: '⚠️ حذف بالكامل', value: 'حذف جميع التذاكر وغرف الانتظار بالكامل من السيرفر وقاعدة البيانات (يتطلب تأكيد مرتين).', inline: false },
        { name: '🔍 حذف تذكرة مخصصة', value: 'حذف تذكرة معينة بناءً على معرف القناة أو رقم التذكرة.', inline: false },
        { name: '🚨 إلغاء أو إغلاق شكوى', value: 'إغلاق شكوى نشطة وحذف قناتها مع تحديث حالتها في قاعدة البيانات.', inline: false }
      )
      .setFooter({ text: 'لوحة التحكم الإدارية • Steal the Brainrot' })
      .setTimestamp();

    const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('ctrl_panel:del_wait')
        .setLabel('حذف غرف الانتظار القديمة')
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId('ctrl_panel:del_active')
        .setLabel('حذف التذاكر النشطة')
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId('ctrl_panel:del_all')
        .setLabel('⚠️ حذف جميع التذاكر')
        .setStyle(ButtonStyle.Danger)
    );

    const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('ctrl_panel:del_custom')
        .setLabel('🔍 حذف تذكرة مخصصة')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('ctrl_panel:close_complaint')
        .setLabel('🚨 إلغاء / إغلاق شكوى')
        .setStyle(ButtonStyle.Primary)
    );

    if (interaction.isChatInputCommand()) {
      await interaction.reply({
        embeds: [embed],
        components: [row1, row2],
        flags: MessageFlags.Ephemeral
      });
    } else {
      await interaction.update({
        embeds: [embed],
        components: [row1, row2]
      }).catch(() => null);
    }
  }

  public async handleDelWaitClick(interaction: ButtonInteraction): Promise<void> {
    if (!isAuthorizedAdmin(interaction.user.id)) {
      await safeReply(interaction, [buildErrorEmbed(this.config, '❌ ليس لديك الصلاحية.')]);
      return;
    }

    const guild = interaction.guild!;
    await safeDeferReply(interaction, 'ctrl_del_wait_defer');

    let count = 0;
    const trackedIds = new Set<string>();

    try {
      const { data: waitTickets } = await this.ticketRepository.client
        .from('tickets')
        .select('*')
        .eq('status', 'open')
        .eq('metadata->>wait_room', 'true');

      if (waitTickets) {
        for (const ticket of waitTickets) {
          if (ticket.channel_id) {
            trackedIds.add(ticket.channel_id);
            const channel = guild.channels.cache.get(ticket.channel_id) || await guild.channels.fetch(ticket.channel_id).catch(() => null);
            if (channel) {
              await channel.delete().catch(() => null);
              count++;
            }
            await this.ticketRepository.closeByChannel(ticket.channel_id, {
              closed_by: interaction.user.id,
              closed_by_tag: interaction.user.tag,
              close_reason: 'Deleted via Admin Control Panel',
            }).catch(() => null);
          }
        }
      }

      const waitCategoryId = '1486147476011352307';
      const channels = await guild.channels.fetch().catch(() => null);
      if (channels) {
        for (const channel of channels.values()) {
          if (channel && channel.parentId === waitCategoryId && (channel.name.startsWith('wait-') || channel.name.startsWith('اكمال-الشروط-'))) {
            if (!trackedIds.has(channel.id)) {
              await channel.delete().catch(() => null);
              count++;
            }
          }
        }
      }

      await safeEditReply(interaction, [buildSuccessEmbed(this.config, 'حذف غرف الانتظار', `✅ تم حذف جميع غرف الانتظار بنجاح. إجمالي الغرف المحذوفة: **${count}**`)]);
    } catch (err) {
      logger.error('Failed to delete wait rooms via admin panel', err);
      await safeEditReply(interaction, [buildErrorEmbed(this.config, 'حدث خطأ أثناء حذف غرف الانتظار.')]);
    }
  }

  public async handleDelActiveClick(interaction: ButtonInteraction): Promise<void> {
    if (!isAuthorizedAdmin(interaction.user.id)) {
      await safeReply(interaction, [buildErrorEmbed(this.config, '❌ ليس لديك الصلاحية.')]);
      return;
    }

    const guild = interaction.guild!;
    await safeDeferReply(interaction, 'ctrl_del_active_defer');

    let count = 0;

    try {
      const { data: activeTickets } = await this.ticketRepository.client
        .from('tickets')
        .select('*')
        .eq('status', 'open')
        .neq('metadata->>wait_room', 'true');

      if (activeTickets) {
        for (const ticket of activeTickets) {
          if ((ticket.metadata as any)?.wait_room === true) continue;

          if (ticket.channel_id) {
            const channel = guild.channels.cache.get(ticket.channel_id) || await guild.channels.fetch(ticket.channel_id).catch(() => null);
            if (channel) {
              await channel.delete().catch(() => null);
              count++;
            }
            await this.ticketRepository.closeByChannel(ticket.channel_id, {
              closed_by: interaction.user.id,
              closed_by_tag: interaction.user.tag,
              close_reason: 'Deleted via Admin Control Panel',
            }).catch(() => null);
          }
        }
      }

      await safeEditReply(interaction, [buildSuccessEmbed(this.config, 'حذف التذاكر النشطة', `✅ تم حذف جميع التذاكر النشطة بنجاح. إجمالي التذاكر المحذوفة: **${count}**`)]);
    } catch (err) {
      logger.error('Failed to delete active tickets via admin panel', err);
      await safeEditReply(interaction, [buildErrorEmbed(this.config, 'حدث خطأ أثناء حذف التذاكر النشطة.')]);
    }
  }

  public async handleDelAllClick(interaction: ButtonInteraction): Promise<void> {
    if (!isAuthorizedAdmin(interaction.user.id)) {
      await safeReply(interaction, [buildErrorEmbed(this.config, '❌ ليس لديك الصلاحية.')]);
      return;
    }

    const embed = new EmbedBuilder()
      .setColor(hexToDecimal(this.config.bot.errorColor))
      .setTitle('⚠️ تأكيد حذف جميع التذاكر بالكامل')
      .setDescription(
        `**هل أنت متأكد من رغبتك في حذف جميع التذاكر بالكامل من السيرفر وقاعدة البيانات؟**\n` +
        `• سيتم حذف جميع غرف الانتظار (WAIT).\n` +
        `• سيتم حذف جميع التذاكر النشطة والمفتوحة.\n\n` +
        `*هذا الإجراء نهائي ولا يمكن التراجع عنه ويجب تأكيده.*`
      )
      .setTimestamp();

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('ctrl_panel:del_all_confirm')
        .setLabel('✅ نعم، متأكد واحذف الكل')
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId('ctrl_panel:cancel')
        .setLabel('❌ إلغاء وتراجع')
        .setStyle(ButtonStyle.Secondary)
    );

    await interaction.update({
      embeds: [embed],
      components: [row]
    }).catch(() => null);
  }

  public async handleDelAllConfirmClick(interaction: ButtonInteraction): Promise<void> {
    if (!isAuthorizedAdmin(interaction.user.id)) {
      await safeReply(interaction, [buildErrorEmbed(this.config, '❌ ليس لديك الصلاحية.')]);
      return;
    }

    const guild = interaction.guild!;
    await safeDeferReply(interaction, 'ctrl_del_all_defer');

    let count = 0;
    const trackedIds = new Set<string>();

    try {
      const { data: openTickets } = await this.ticketRepository.client
        .from('tickets')
        .select('*')
        .eq('status', 'open');

      if (openTickets) {
        for (const ticket of openTickets) {
          if (ticket.channel_id) {
            trackedIds.add(ticket.channel_id);
            const channel = guild.channels.cache.get(ticket.channel_id) || await guild.channels.fetch(ticket.channel_id).catch(() => null);
            if (channel) {
              await channel.delete().catch(() => null);
              count++;
            }
            await this.ticketRepository.closeByChannel(ticket.channel_id, {
              closed_by: interaction.user.id,
              closed_by_tag: interaction.user.tag,
              close_reason: 'Deleted via Admin Control Panel (Bulk Deletion)',
            }).catch(() => null);
          }
        }
      }

      const waitCategoryId = '1486147476011352307';
      const channels = await guild.channels.fetch().catch(() => null);
      if (channels) {
        for (const channel of channels.values()) {
          if (channel && channel.parentId === waitCategoryId && (channel.name.startsWith('wait-') || channel.name.startsWith('اكمال-الشروط-'))) {
            if (!trackedIds.has(channel.id)) {
              await channel.delete().catch(() => null);
              count++;
            }
          }
        }
      }

      await safeEditReply(interaction, [buildSuccessEmbed(this.config, 'حذف جميع التذاكر', `✅ تم حذف جميع التذاكر بالكامل بنجاح. إجمالي القنوات المحذوفة: **${count}**`)]);
    } catch (err) {
      logger.error('Failed to bulk delete all tickets', err);
      await safeEditReply(interaction, [buildErrorEmbed(this.config, 'حدث خطأ أثناء الحذف الكامل للتذاكر.')]);
    }
  }

  public async handleDelCustomClick(interaction: ButtonInteraction): Promise<void> {
    if (!isAuthorizedAdmin(interaction.user.id)) {
      await safeReply(interaction, [buildErrorEmbed(this.config, '❌ ليس لديك الصلاحية.')]);
      return;
    }

    const modal = new ModalBuilder()
      .setCustomId('ctrl_panel:modal:del_custom')
      .setTitle('حذف تذكرة مخصصة');

    const input = new TextInputBuilder()
      .setCustomId('target_input')
      .setLabel('معرف القناة أو رقم التذكرة')
      .setPlaceholder('مثال: 123456789012345678 أو 105')
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setMinLength(1)
      .setMaxLength(30);

    const row = new ActionRowBuilder<TextInputBuilder>().addComponents(input);
    modal.addComponents(row);

    await safeShowModal(interaction, modal, 'ctrl_panel:modal:del_custom');
  }

  public async handleDelCustomModalSubmit(interaction: ModalSubmitInteraction): Promise<void> {
    if (!isAuthorizedAdmin(interaction.user.id)) {
      await safeReply(interaction, [buildErrorEmbed(this.config, '❌ ليس لديك الصلاحية.')]);
      return;
    }

    const rawInput = interaction.fields.getTextInputValue('target_input').trim();
    const guild = interaction.guild!;

    await safeDeferReply(interaction, 'ctrl_del_custom_defer');

    let ticket: TicketRecord | null = null;

    try {
      if (/^\d+$/.test(rawInput)) {
        if (rawInput.length > 10) {
          ticket = await this.ticketRepository.findByChannelId(rawInput);
        } else {
          const num = Number(rawInput);
          const { data } = await this.ticketRepository.client
            .from('tickets')
            .select('*')
            .eq('ticket_number', num)
            .eq('status', 'open')
            .maybeSingle();
          if (data) {
            ticket = data as TicketRecord;
          }
        }
      }

      if (!ticket) {
        ticket = await this.ticketRepository.findByChannelId(rawInput);
      }

      let deleted = false;
      let channelId = ticket?.channel_id || rawInput;

      const channel = guild.channels.cache.get(channelId) || await guild.channels.fetch(channelId).catch(() => null);
      if (channel) {
        await channel.delete().catch(() => null);
        deleted = true;
      }

      if (ticket && ticket.channel_id) {
        const closedTicket = await this.ticketRepository.closeByChannel(ticket.channel_id, {
          closed_by: interaction.user.id,
          closed_by_tag: interaction.user.tag,
          close_reason: 'Deleted via Admin Control Panel (Custom Deletion)',
        }).catch(() => null);
        if (closedTicket) {
          await this.incrementCompletedTicket(closedTicket).catch(() => null);
        }
        deleted = true;
      }

      if (deleted) {
        await safeEditReply(interaction, [buildSuccessEmbed(this.config, 'حذف تذكرة مخصصة', `✅ تم حذف التذكرة **${rawInput}** بنجاح.`)]);
      } else {
        await safeEditReply(interaction, [buildErrorEmbed(this.config, `❌ لم يتم العثور على تذكرة أو قناة بالمعرف/الرقم **${rawInput}**.`)]);
      }
    } catch (err) {
      logger.error('Failed to delete custom ticket', err);
      await safeEditReply(interaction, [buildErrorEmbed(this.config, 'حدث خطأ أثناء معالجة الحذف.')]);
    }
  }

  private async incrementCompletedTicket(ticket: TicketRecord): Promise<void> {
    if (ticket.claimed_by) {
      try {
        const mediator = await this.mediatorRepository.getMediator(ticket.claimed_by).catch(() => null);
        if (mediator) {
          await this.mediatorRepository.updateMediator(ticket.claimed_by, {
            tickets_completed: (mediator.tickets_completed || 0) + 1
          });
        }
      } catch (err) {
        logger.error('Failed to increment completed tickets for mediator', err);
      }
    }
  }
}
