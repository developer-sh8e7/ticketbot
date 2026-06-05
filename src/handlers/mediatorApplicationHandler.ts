import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  EmbedBuilder,
  GuildMember,
  MessageFlags,
  ModalBuilder,
  PermissionFlagsBits,
  TextInputBuilder,
  TextInputStyle,
  type ButtonInteraction,
  type ModalSubmitInteraction,
  type TextChannel,
} from 'discord.js';
import {
  MEDIATOR_ACCEPT_MODAL_PREFIX,
  MEDIATOR_ACCEPT_PREFIX,
  MEDIATOR_CLOSE_CANCEL_PREFIX,
  MEDIATOR_CLOSE_CONFIRM_PREFIX,
  MEDIATOR_CLOSE_PREFIX,
  MEDIATOR_REJECT_MODAL_PREFIX,
  MEDIATOR_REJECT_PREFIX,
  ALLOWED_ADMIN_IDS,
  isAuthorizedAdmin,
} from '../constants/customIds.js';
import {
  type MediatorApplicationRecord,
  type MediatorRepository,
} from '../database/mediatorRepository.js';
import type { Env } from '../env.js';
import type { ConfigStore } from '../services/configStore.js';
import type { PanelService } from '../services/panelService.js';
import type { TranscriptService } from '../services/transcriptService.js';
import { logger } from '../utils/logger.js';
import { normalizeChannelName } from '../utils/text.js';

const BLURPLE = 0x5865f2;
const SUCCESS = 0x57f287;
const DANGER = 0xed4245;

function applicationId(customId: string, prefix: string): string {
  return customId.slice(prefix.length);
}

export class MediatorApplicationHandler {
  public constructor(
    private readonly mediatorRepository: MediatorRepository,
    private readonly configStore: ConfigStore,
    private readonly env: Env,
    private readonly transcriptService: TranscriptService,
    private readonly panelService: PanelService,
  ) {}

  private isStaff(member: GuildMember): boolean {
    if (isAuthorizedAdmin(member.id)) return true;
    return Boolean(this.env.STAFF_ROLE_ID && member.roles.cache.has(this.env.STAFF_ROLE_ID));
  }

  private actionRows(application: MediatorApplicationRecord, disabled = false) {
    return [
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`${MEDIATOR_ACCEPT_PREFIX}${application.id}`)
          .setLabel('قبول الطلب')
          .setEmoji('✅')
          .setStyle(ButtonStyle.Success)
          .setDisabled(disabled),
        new ButtonBuilder()
          .setCustomId(`${MEDIATOR_REJECT_PREFIX}${application.id}`)
          .setLabel('رفض الطلب')
          .setEmoji('❌')
          .setStyle(ButtonStyle.Danger)
          .setDisabled(disabled),
        new ButtonBuilder()
          .setCustomId(`${MEDIATOR_CLOSE_PREFIX}${application.id}`)
          .setLabel('إغلاق التذكرة')
          .setEmoji('🔒')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(disabled),
      ),
    ];
  }

  private buildApplicationEmbed(
    application: MediatorApplicationRecord,
    avatarUrl: string,
    status: 'open' | 'accepted' | 'rejected' = 'open',
    decisionText?: string,
  ): EmbedBuilder {
    const statusText = status === 'accepted'
      ? '🟢 مقبول'
      : status === 'rejected'
        ? '🔴 مرفوض'
        : '🟢 مفتوحة';
    const color = status === 'accepted' ? SUCCESS : status === 'rejected' ? DANGER : BLURPLE;
    const embed = new EmbedBuilder()
      .setColor(color)
      .setAuthor({
        name: 'طلب تقديم وسيط جديد',
        iconURL: avatarUrl,
      })
      .setDescription(
        'تم إنشاء هذه التذكرة تلقائياً بعد اجتياز عملية التحقق الكامل.\n' +
        'يرجى من الإدارة مراجعة الطلب والرد في أقرب وقت.',
      )
      .addFields(
        { name: '👤 المتقدم', value: `<@${application.applicant_id}>`, inline: true },
        { name: '🆔 Discord ID', value: `\`${application.applicant_id}\``, inline: true },
        {
          name: '📅 تاريخ التحقق',
          value: application.verified_at
            ? `<t:${Math.floor(new Date(application.verified_at).getTime() / 1000)}:F>`
            : 'محفوظ في النظام',
          inline: true,
        },
        {
          name: '⏰ وقت الفتح',
          value: `<t:${Math.floor(new Date(application.opened_at).getTime() / 1000)}:F>`,
          inline: true,
        },
        
        { name: '📊 حالة التذكرة', value: statusText, inline: true },
      )
      .setThumbnail(avatarUrl)
      .setFooter({ text: 'STB Arab • نظام التقديم' })
      .setTimestamp();

    if (decisionText) {
      embed.addFields({ name: status === 'accepted' ? '📝 ملاحظات القبول' : '📝 سبب الرفض', value: decisionText });
    }
    return embed;
  }

  private async getApplicationOrReply(
    interaction: ButtonInteraction | ModalSubmitInteraction,
    id: string,
  ): Promise<MediatorApplicationRecord | null> {
    const channelApplication = interaction.channelId
      ? await this.mediatorRepository.getMediatorApplicationByChannel(interaction.channelId)
      : null;
    if (!channelApplication || channelApplication.id !== id) {
      await interaction.reply({
        flags: MessageFlags.Ephemeral,
        embeds: [new EmbedBuilder().setColor(DANGER).setTitle('تعذر العثور على الطلب')],
      }).catch(() => null);
      return null;
    }
    return channelApplication;
  }

  public async handle(interaction: ButtonInteraction): Promise<void> {
    if (!interaction.inCachedGuild()) {
      await interaction.reply({ flags: MessageFlags.Ephemeral, content: 'هذا الزر يعمل داخل السيرفر فقط.' });
      return;
    }
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const mediatorConfig = await this.mediatorRepository.getMediatorConfig();
    if (!mediatorConfig.is_open || mediatorConfig.current_count >= mediatorConfig.max_count) {
      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(DANGER)
            .setTitle('التقديم مغلق حالياً')
            .setDescription(`عدد الوسطاء: **${mediatorConfig.current_count}/${mediatorConfig.max_count}**`),
        ],
      });
      return;
    }

    const verification = await this.mediatorRepository.checkVerificationStatus(interaction.user.id);
    if (!verification?.isFullyVerified) {
      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(DANGER)
            .setTitle('التحقق مطلوب')
            .setDescription('أكمل التحقق من الديسكورد والواتساب قبل فتح طلب التقديم.'),
        ],
        components: [
          new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
              .setLabel('ابدأ التحقق')
              .setStyle(ButtonStyle.Link)
              .setURL(this.env.VERIFY_URL || 'https://stb-arab.vercel.app/verify'),
          ),
        ],
      });
      return;
    }

    const existing = await this.mediatorRepository.findOpenMediatorApplication(
      interaction.guildId,
      interaction.user.id,
    );
    if (existing) {
      const channel = await interaction.guild.channels.fetch(existing.channel_id).catch(() => null);
      if (channel) {
        await interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setColor(BLURPLE)
              .setTitle('لديك طلب مفتوح بالفعل')
              .setDescription(`يمكنك متابعة طلبك من <#${existing.channel_id}>.`),
          ],
        });
        return;
      }
      await this.mediatorRepository.updateMediatorApplication(existing.id, {
        status: 'closed',
        closed_at: new Date().toISOString(),
      });
    }

    const staffRole = this.env.STAFF_ROLE_ID
      ? interaction.guild.roles.cache.get(this.env.STAFF_ROLE_ID)
      : null;
    const channel = await interaction.guild.channels.create({
      name: normalizeChannelName(
        `تقديم-وسيط-${interaction.user.username}-${Date.now().toString().slice(-5)}`,
        this.configStore.current.naming.maxChannelNameLength,
      ),
      type: ChannelType.GuildText,
      parent: this.configStore.current.guild.categoryId,
      topic: `Mediator applicant: ${interaction.user.id}`,
      permissionOverwrites: [
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
        ...(staffRole
          ? [{
              id: staffRole.id,
              allow: [
                PermissionFlagsBits.ViewChannel,
                PermissionFlagsBits.SendMessages,
                PermissionFlagsBits.ReadMessageHistory,
                PermissionFlagsBits.ManageMessages,
              ],
            }]
          : []),
        ...ALLOWED_ADMIN_IDS
          .filter((userId) => userId !== interaction.user.id)
          .map((userId) => ({
            id: userId,
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.SendMessages,
              PermissionFlagsBits.ReadMessageHistory,
              PermissionFlagsBits.ManageMessages,
            ],
          })),
        ...(interaction.guild.members.me
          ? [{
              id: interaction.guild.members.me.id,
              allow: [
                PermissionFlagsBits.ViewChannel,
                PermissionFlagsBits.SendMessages,
                PermissionFlagsBits.ReadMessageHistory,
                PermissionFlagsBits.ManageChannels,
                PermissionFlagsBits.ManageMessages,
              ],
            }]
          : []),
      ],
    });

    try {
      const application = await this.mediatorRepository.createMediatorApplication({
        guildId: interaction.guildId,
        channelId: channel.id,
        applicantId: interaction.user.id,
        applicantTag: interaction.user.tag,
        verifiedAt: verification.verifiedAt,
      });
      await channel.setTopic(`Mediator application: ${application.id} | Applicant: ${interaction.user.id}`);
      const avatarUrl = interaction.user.displayAvatarURL({ extension: 'png', size: 256 });
      const message = await channel.send({
        content: staffRole
          ? `<@${interaction.user.id}> <@&${staffRole.id}>`
          : `<@${interaction.user.id}>`,
        embeds: [this.buildApplicationEmbed(application, avatarUrl)],
        components: this.actionRows(application),
        allowedMentions: {
          users: [interaction.user.id],
          roles: staffRole ? [staffRole.id] : [],
        },
      });
      await this.mediatorRepository.setMediatorApplicationMessage(application.id, message.id);
      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(SUCCESS)
            .setTitle('تم فتح طلب التقديم')
            .setDescription(`تم إنشاء قناة خاصة لطلبك: <#${channel.id}>`),
        ],
      });
    } catch (error) {
      await channel.delete('Failed to persist mediator application').catch(() => null);
      throw error;
    }
  }

  public async handleActionButton(interaction: ButtonInteraction): Promise<void> {
    if (!interaction.inCachedGuild() || !(interaction.member instanceof GuildMember)) return;
    const customId = interaction.customId;

    if (customId.startsWith(MEDIATOR_ACCEPT_PREFIX) || customId.startsWith(MEDIATOR_REJECT_PREFIX)) {
      if (!this.isStaff(interaction.member)) {
        await interaction.reply({ flags: MessageFlags.Ephemeral, content: 'ليس لديك صلاحية لاتخاذ القرار.' });
        return;
      }
      const accepting = customId.startsWith(MEDIATOR_ACCEPT_PREFIX);
      const prefix = accepting ? MEDIATOR_ACCEPT_PREFIX : MEDIATOR_REJECT_PREFIX;
      const id = applicationId(customId, prefix);
      const application = await this.getApplicationOrReply(interaction, id);
      if (!application || application.status !== 'open') {
        if (application) {
          await interaction.reply({ flags: MessageFlags.Ephemeral, content: 'تم اتخاذ قرار على هذا الطلب مسبقاً.' });
        }
        return;
      }

      const input = new TextInputBuilder()
        .setCustomId(accepting ? 'decision_notes' : 'rejection_reason')
        .setLabel(accepting ? 'ملاحظات القبول' : 'سبب الرفض')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(!accepting)
        .setMaxLength(800);
      const modal = new ModalBuilder()
        .setCustomId(`${accepting ? MEDIATOR_ACCEPT_MODAL_PREFIX : MEDIATOR_REJECT_MODAL_PREFIX}${id}`)
        .setTitle(accepting ? 'قبول طلب الوسيط' : 'رفض طلب الوسيط')
        .addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(input));
      await interaction.showModal(modal);
      return;
    }

    if (customId.startsWith(MEDIATOR_CLOSE_PREFIX)) {
      const id = applicationId(customId, MEDIATOR_CLOSE_PREFIX);
      const application = await this.getApplicationOrReply(interaction, id);
      if (!application) return;
      if (!this.isStaff(interaction.member) && interaction.user.id !== application.applicant_id) {
        await interaction.reply({ flags: MessageFlags.Ephemeral, content: 'لا يمكنك إغلاق هذه التذكرة.' });
        return;
      }
      await interaction.reply({
        flags: MessageFlags.Ephemeral,
        embeds: [
          new EmbedBuilder()
            .setColor(DANGER)
            .setTitle('تأكيد إغلاق التذكرة')
            .setDescription('سيتم حفظ المحادثة ثم حذف القناة بعد 10 ثوانٍ.'),
        ],
        components: [
          new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
              .setCustomId(`${MEDIATOR_CLOSE_CONFIRM_PREFIX}${id}`)
              .setLabel('نعم، أغلق')
              .setStyle(ButtonStyle.Danger),
            new ButtonBuilder()
              .setCustomId(`${MEDIATOR_CLOSE_CANCEL_PREFIX}${id}`)
              .setLabel('إلغاء')
              .setStyle(ButtonStyle.Secondary),
          ),
        ],
      });
      return;
    }

    if (customId.startsWith(MEDIATOR_CLOSE_CANCEL_PREFIX)) {
      await interaction.update({ content: 'تم إلغاء الإغلاق.', embeds: [], components: [] });
      return;
    }

    if (customId.startsWith(MEDIATOR_CLOSE_CONFIRM_PREFIX)) {
      const id = applicationId(customId, MEDIATOR_CLOSE_CONFIRM_PREFIX);
      const application = await this.getApplicationOrReply(interaction, id);
      if (!application || !interaction.channel || interaction.channel.type !== ChannelType.GuildText) return;
      if (!this.isStaff(interaction.member) && interaction.user.id !== application.applicant_id) {
        await interaction.reply({ flags: MessageFlags.Ephemeral, content: 'لا يمكنك إغلاق هذه التذكرة.' });
        return;
      }
      await interaction.update({ content: 'جاري حفظ المحادثة وإغلاق التذكرة...', embeds: [], components: [] });
      await this.closeApplicationChannel(interaction.channel, application, interaction.user.id);
    }
  }

  public async handleDecisionModal(interaction: ModalSubmitInteraction): Promise<void> {
    if (!interaction.inCachedGuild() || !(interaction.member instanceof GuildMember)) return;
    if (!this.isStaff(interaction.member)) {
      await interaction.reply({ flags: MessageFlags.Ephemeral, content: 'ليس لديك صلاحية لاتخاذ القرار.' });
      return;
    }

    const accepting = interaction.customId.startsWith(MEDIATOR_ACCEPT_MODAL_PREFIX);
    const prefix = accepting ? MEDIATOR_ACCEPT_MODAL_PREFIX : MEDIATOR_REJECT_MODAL_PREFIX;
    const id = applicationId(interaction.customId, prefix);
    const application = await this.getApplicationOrReply(interaction, id);
    if (!application) return;
    if (application.status !== 'open') {
      await interaction.reply({ flags: MessageFlags.Ephemeral, content: 'تم اتخاذ قرار على هذا الطلب مسبقاً.' });
      return;
    }
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    if (accepting) {
      await this.acceptApplication(interaction, application);
    } else {
      await this.rejectApplication(interaction, application);
    }
  }

  private async acceptApplication(
    interaction: ModalSubmitInteraction<'cached'>,
    application: MediatorApplicationRecord,
  ): Promise<void> {
    const roleId = this.env.MEDIATOR_ROLE_ID;
    if (!roleId) throw new Error('MEDIATOR_ROLE_ID is not configured');
    const member = await interaction.guild.members.fetch(application.applicant_id);
    const role = await interaction.guild.roles.fetch(roleId);
    if (!role) throw new Error('Mediator role does not exist');
    const notes = interaction.fields.getTextInputValue('decision_notes').trim() || 'لا توجد ملاحظات.';
    let assignedRole = false;
    let decisionSaved = false;

    try {
      const decided = await this.mediatorRepository.decideMediatorApplication(application.id, {
        status: 'accepted',
        decided_by: interaction.user.id,
        decision_notes: notes,
        rejection_reason: null,
        decided_at: new Date().toISOString(),
      });
      if (!decided) {
        await interaction.editReply({ content: 'تم اتخاذ قرار على هذا الطلب مسبقًا.' });
        return;
      }
      decisionSaved = true;

      if (!member.roles.cache.has(roleId)) {
        await member.roles.add(role, `Mediator application accepted by ${interaction.user.tag}`);
        assignedRole = true;
      }
      const existingMediator = await this.mediatorRepository.getMediator(application.applicant_id);
      if (!existingMediator || existingMediator.status === 'removed') {
        await this.mediatorRepository.createMediator({
          user_id: application.applicant_id,
          username: application.applicant_tag,
          status: 'trial',
          assigned_by: interaction.user.id,
          assigned_by_tag: interaction.user.tag,
          assigned_reason: 'Accepted through mediator application',
          trial_period: 'حسب قرار الإدارة',
          notes,
        });
      }
      await this.mediatorRepository.incrementMediatorCount();
      await this.updateApplicationMessage(interaction.channel as TextChannel, decided, 'accepted', notes);
      await member.send({
        embeds: [
          new EmbedBuilder()
            .setColor(SUCCESS)
            .setTitle('تم قبولك كوسيط في السيرفر!')
            .setDescription('تمت مراجعة طلبك وقبوله، وتم منحك رتبة الوسيط.'),
        ],
      }).catch(() => null);
      await this.panelService.refreshPanel(interaction.guild).catch((error) => {
        logger.warn('Failed to refresh panel after mediator acceptance.', error);
      });
      await interaction.editReply({ content: `تم قبول <@${application.applicant_id}> ومنحه رتبة <@&${roleId}>.` });
    } catch (error) {
      if (assignedRole) {
        await member.roles.remove(roleId, 'Rollback failed mediator acceptance').catch(() => null);
      }
      if (decisionSaved) {
        await this.mediatorRepository.updateMediatorApplication(application.id, {
          status: 'open',
          decided_by: null,
          decision_notes: null,
          rejection_reason: null,
          decided_at: null,
        }).catch(() => null);
      }
      throw error;
    }
  }

  private async rejectApplication(
    interaction: ModalSubmitInteraction<'cached'>,
    application: MediatorApplicationRecord,
  ): Promise<void> {
    const reason = interaction.fields.getTextInputValue('rejection_reason').trim();
    const updated = await this.mediatorRepository.decideMediatorApplication(application.id, {
      status: 'rejected',
      decided_by: interaction.user.id,
      decision_notes: null,
      rejection_reason: reason,
      decided_at: new Date().toISOString(),
    });
    if (!updated) {
      await interaction.editReply({ content: 'تم اتخاذ قرار على هذا الطلب مسبقًا.' });
      return;
    }
    await this.updateApplicationMessage(interaction.channel as TextChannel, updated, 'rejected', reason);
    const user = await interaction.client.users.fetch(application.applicant_id).catch(() => null);
    await user?.send({
      embeds: [
        new EmbedBuilder()
          .setColor(DANGER)
          .setTitle('تم رفض طلب التقديم على رتبة وسيط')
          .setDescription(`**السبب:**\n${reason}`),
      ],
    }).catch(() => null);
    await interaction.editReply({ content: `تم رفض طلب <@${application.applicant_id}> وإبلاغه بالسبب.` });
  }

  private async updateApplicationMessage(
    channel: TextChannel,
    application: MediatorApplicationRecord,
    status: 'accepted' | 'rejected',
    decisionText: string,
  ): Promise<void> {
    if (!application.message_id) return;
    const message = await channel.messages.fetch(application.message_id).catch(() => null);
    if (!message) return;
    const user = await channel.client.users.fetch(application.applicant_id);
    await message.edit({
      embeds: [
        this.buildApplicationEmbed(
          application,
          user.displayAvatarURL({ extension: 'png', size: 256 }),
          status,
          decisionText,
        ),
      ],
      components: this.actionRows(application, true),
    });
    await channel.send({
      embeds: [
        new EmbedBuilder()
          .setColor(status === 'accepted' ? SUCCESS : DANGER)
          .setTitle(status === 'accepted' ? 'تم قبول الطلب' : 'تم رفض الطلب')
          .setDescription(
            `${status === 'accepted' ? 'تم قبول' : 'تم رفض'} طلب <@${application.applicant_id}>.\n` +
            `بواسطة: <@${application.decided_by}>`,
          )
          .setTimestamp(),
      ],
    });
  }

  private async closeApplicationChannel(
    channel: TextChannel,
    application: MediatorApplicationRecord,
    closedBy: string,
  ): Promise<void> {
    const attachment = await this.transcriptService.buildTextAttachment(
      channel,
      `mediator-application-${application.id}.txt`,
    );
    const logChannelId = this.env.LOG_CHANNEL_ID;
    if (logChannelId) {
      const logChannel = await channel.guild.channels.fetch(logChannelId).catch(() => null);
      if (logChannel?.type === ChannelType.GuildText) {
        await logChannel.send({
          embeds: [
            new EmbedBuilder()
              .setColor(BLURPLE)
              .setTitle('إغلاق تذكرة تقديم وسيط')
              .addFields(
                { name: 'المتقدم', value: `<@${application.applicant_id}>`, inline: true },
                { name: 'أغلقها', value: `<@${closedBy}>`, inline: true },
                { name: 'الحالة', value: application.status, inline: true },
              )
              .setTimestamp(),
          ],
          files: [attachment],
        });
      }
    }
    await this.mediatorRepository.updateMediatorApplication(application.id, {
      status: application.status === 'open' ? 'closed' : application.status,
      closed_at: new Date().toISOString(),
    });
    await channel.send('سيتم حذف هذه القناة خلال 10 ثوانٍ.');
    setTimeout(() => {
      void channel.delete(`Mediator application closed by ${closedBy}`).catch((error) => {
        logger.error('Failed to delete mediator application channel.', error);
      });
    }, 10_000);
  }
}
