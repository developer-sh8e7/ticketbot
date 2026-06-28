import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  PermissionFlagsBits,
  MessageFlags,
  type ButtonInteraction,
  type ChatInputCommandInteraction,
  type ModalSubmitInteraction,
  type Guild,
  type GuildMember,
  type TextChannel,
  type Message
} from 'discord.js';
import type { ConfigStore } from './configStore.js';
import { ComplaintRepository, type ComplaintRecord } from '../database/complaintRepository.js';
import { TicketRepository } from '../database/ticketRepository.js';
import { MediatorRepository } from '../database/mediatorRepository.js';
import { isAuthorizedAdmin } from '../constants/customIds.js';
import { padTicketNumber } from '../utils/text.js';
import { hexToDecimal } from '../utils/color.js';
import { isGuildTextChannelType } from '../utils/discord.js';
import { safeReply, safeEditReply, safeDeferReply, safeShowModal } from '../utils/interaction.js';
import { logger } from '../utils/logger.js';
import { buildErrorEmbed, buildSuccessEmbed } from '../builders/ticketBuilder.js';

const ROLE_COMPENSATION = '1507646852869259325';
const COMPLAINT_CHANNEL_ID = '1507929693687644301';
const COMPLAINT_CATEGORY_ID = '1507928422100504576';
const LOG_CHANNEL_ID = '1486132662753034280';
const COMPLAINT_PANEL_IMAGE_URL = 'https://i.imgur.com/AJ6qbEM.jpeg';

export class ComplaintService {
  private readonly creatingUsers = new Set<string>();

  public constructor(
    private readonly configStore: ConfigStore,
    private readonly complaintRepository: ComplaintRepository,
    private readonly ticketRepository: TicketRepository,
    private readonly mediatorRepository: MediatorRepository
  ) {}

  private get config() {
    return this.configStore.current;
  }

  /**
   * Setup complaints panel command.
   * Sends the complaints selection panel to 1507929693687644301.
   */
  public async sendComplaintsPanelCommand(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!interaction.inCachedGuild()) return;

    if (!isAuthorizedAdmin(interaction.user.id)) {
      await safeReply(interaction, [buildErrorEmbed(this.config, '❌ ليس لديك الصلاحية لاستخدام هذا الأمر.')]);
      return;
    }

    const channel = interaction.guild.channels.cache.get(COMPLAINT_CHANNEL_ID);
    if (!isGuildTextChannelType(channel || null)) {
      await safeReply(interaction, [buildErrorEmbed(this.config, `❌ لم يتم العثور على القناة المحددة للشكاوى (ID: ${COMPLAINT_CHANNEL_ID}).`)]);
      return;
    }

    const textChannel = channel as TextChannel;
    await safeDeferReply(interaction);

    const embed = new EmbedBuilder()
      .setColor(hexToDecimal(this.config.bot.embedColor))
      .setImage(COMPLAINT_PANEL_IMAGE_URL);

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('complaint:btn:mediator')
        .setLabel('👤 شكوى على وسيط')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId('complaint:btn:general')
        .setLabel('📝 شكوى عامة / إدارية')
        .setStyle(ButtonStyle.Primary)
    );

    await textChannel.send({ embeds: [embed], components: [row] });
    await safeEditReply(interaction, [buildSuccessEmbed(this.config, 'تم إرسال اللوحة', `✅ تم إرسال لوحة الشكاوى إلى القناة <#${COMPLAINT_CHANNEL_ID}> بنجاح.`)]);
  }

  /**
   * Handle complaints panel button clicks.
   */
  public async handleComplaintButton(interaction: ButtonInteraction): Promise<void> {
    const userId = interaction.user.id;

    // Rate Limit Check (1 complaint per 5 minutes)
    const rateLimited = await this.complaintRepository.checkUserRateLimit(userId, 5).catch(() => false);
    if (rateLimited) {
      await interaction.reply({
        embeds: [buildErrorEmbed(this.config, '⏱️ يرجى الانتظار قليلاً قبل تقديم شكوى أخرى (يمكنك تقديم شكوى واحدة كل 5 دقائق).')],
        flags: MessageFlags.Ephemeral
      }).catch(() => null);
      return;
    }

    // Active Complaint Check (Max 1 open/reviewing complaint)
    const activeExists = await this.complaintRepository.checkActiveComplaintExistsForUser(userId).catch(() => false);
    if (activeExists) {
      await interaction.reply({
        embeds: [buildErrorEmbed(this.config, '❌ لديك شكوى نشطة بالفعل قيد المراجعة. يرجى الانتظار حتى يتم حلها قبل فتح شكوى جديدة.')],
        flags: MessageFlags.Ephemeral
      }).catch(() => null);
      return;
    }

    const customId = interaction.customId;

    if (customId === 'complaint:btn:mediator') {
      const modal = new ModalBuilder()
        .setCustomId('complaint:modal:mediator')
        .setTitle('تقديم شكوى على وسيط');

      modal.addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId('mediator_id')
            .setLabel('آيدي الوسيط (User ID)')
            .setPlaceholder('مثال: 959896496113844254')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
        ),
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId('ticket_number')
            .setLabel('رقم التذكرة المرتبطة (إن وجد)')
            .setPlaceholder('اكتب رقم التذكرة فقط (مثال: 0015) أو اتركه فارغاً')
            .setStyle(TextInputStyle.Short)
            .setRequired(false)
        ),
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId('category')
            .setLabel('نوع المشكلة (نصب / تأخير / سوء تعامل / أخرى)')
            .setPlaceholder('اكتب تصنيف المشكلة هنا')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
        ),
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId('trade_value')
            .setLabel('قيمة التريد وما تم سرقته أو فقده')
            .setPlaceholder('مثال: 50$ أو حساب Epic أو لعبة معينة')
            .setStyle(TextInputStyle.Short)
            .setRequired(false)
        ),
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId('description')
            .setLabel('تفاصيل ووصف المشكلة بالكامل')
            .setPlaceholder('اشرح ما حدث بالتفصيل هنا')
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true)
        )
      );

      await safeShowModal(interaction, modal, 'complaint_modal_mediator');
      return;
    }

    if (customId === 'complaint:btn:general') {
      const modal = new ModalBuilder()
        .setCustomId('complaint:modal:general')
        .setTitle('تقديم شكوى عامة / إدارية');

      modal.addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId('title')
            .setLabel('عنوان الشكوى')
            .setPlaceholder('اكتب عنواناً يصف موضوع الشكوى')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
        ),
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId('ticket_number')
            .setLabel('رقم التذكرة المرتبطة')
            .setPlaceholder('اكتب رقم التذكرة المرتبطة بالشكوى (مثال: 0015)')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
        ),
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId('description')
            .setLabel('تفاصيل الشكوى بالكامل')
            .setPlaceholder('اكتب كافة تفاصيل الشكوى هنا')
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true)
        )
      );

      await safeShowModal(interaction, modal, 'complaint_modal_general');
      return;
    }
  }

  /**
   * Helper to parse user ID from string or mention.
   */
  private parseUserId(input: string): string | null {
    const cleaned = input.trim();
    const match = cleaned.match(/^<@!?(\d+)>$/);
    if (match) return match[1];
    if (/^\d+$/.test(cleaned)) return cleaned;
    return null;
  }

  /**
   * Handle modal submissions.
   */
  public async handleComplaintModalSubmit(interaction: ModalSubmitInteraction): Promise<void> {
    if (!interaction.inCachedGuild()) return;
    const guild = interaction.guild!;
    const customId = interaction.customId;

    await safeDeferReply(interaction, `complaint_modal:${customId}`);

    const userId = interaction.user.id;

    // Concurrency Lock: prevent same user from submitting multiple creation requests simultaneously
    if (this.creatingUsers.has(userId)) {
      await safeEditReply(interaction, [buildErrorEmbed(this.config, '🔄 جاري إنشاء تذكرة الشكوى الخاصة بك بالفعل. يرجى الانتظار.')]);
      return;
    }
    this.creatingUsers.add(userId);

    try {
      // Double-check rate limit on modal submit (prevent direct modal triggers or quick spam)
      const rateLimited = await this.complaintRepository.checkUserRateLimit(userId, 5).catch(() => false);
      if (rateLimited) {
        await safeEditReply(interaction, [buildErrorEmbed(this.config, '⏱️ يرجى الانتظار قليلاً قبل تقديم شكوى أخرى (يمكنك تقديم شكوى واحدة كل 5 دقائق).')]);
        return;
      }

      // Double-check active complaints check on modal submit
      const activeExists = await this.complaintRepository.checkActiveComplaintExistsForUser(userId).catch(() => false);
      if (activeExists) {
        await safeEditReply(interaction, [buildErrorEmbed(this.config, '❌ لديك شكوى نشطة بالفعل قيد المراجعة. يرجى الانتظار حتى يتم حلها قبل فتح شكوى جديدة.')]);
        return;
      }

      const ticketInput = interaction.fields.getTextInputValue('ticket_number') || null;
      let linkedTicketRecord: any = null;

      if (ticketInput) {
        const parsedNum = parseInt(ticketInput.replace(/\D/g, ''), 10);
        if (!isNaN(parsedNum)) {
          const records = await this.ticketRepository.listAll().catch(() => []);
          linkedTicketRecord = records.find((r: any) => r.ticket_number === parsedNum) || null;
        }

        if (!linkedTicketRecord) {
          await safeEditReply(interaction, [buildErrorEmbed(this.config, '❌ رقم التذكرة المرتبطة غير صحيح أو غير موجود بالنظام. يرجى إدخال رقم تذكرة صحيح (مثال: 0015).')]);
          return;
        }

        // Duplicate Protection: check if there's already an active complaint on this ticket
        const ticketId = linkedTicketRecord.channel_id || linkedTicketRecord.id;
        const altId = linkedTicketRecord.id || linkedTicketRecord.channel_id;
        const dupExists = await this.complaintRepository.checkActiveComplaintExistsForTicket(ticketId, altId);
        if (dupExists) {
          await safeEditReply(interaction, [buildErrorEmbed(this.config, '❌ يوجد بالفعل شكوى نشطة ومفتوحة مرتبطة بهذه التذكرة. يمنع تكرار الشكاوى على نفس التذكرة.')]);
          return;
        }
      } else {
        // ticketInput is null. If this is a general complaint, it is strictly required!
        if (customId === 'complaint:modal:general') {
          await safeEditReply(interaction, [buildErrorEmbed(this.config, '❌ يجب إدخال رقم التذكرة المرتبطة للشكاوى العامة.')]);
          return;
        }
      }

      let complaintRecord: ComplaintRecord | null = null;
      let complaintChannelName = '';
      let accusedMediatorId: string | null = null;
      let category = '';
      let tradeValue: string | null = null;
      let description = '';
      let complaintType: 'mediator' | 'general' = 'general';

      if (customId === 'complaint:modal:mediator') {
        complaintType = 'mediator';
        const rawMediatorId = interaction.fields.getTextInputValue('mediator_id');
        accusedMediatorId = this.parseUserId(rawMediatorId);
        category = interaction.fields.getTextInputValue('category');
        tradeValue = interaction.fields.getTextInputValue('trade_value') || null;
        description = interaction.fields.getTextInputValue('description');

        if (!accusedMediatorId) {
          await safeEditReply(interaction, [buildErrorEmbed(this.config, '❌ معرف الوسيط غير صحيح. يرجى إدخال آيدي الوسيط بشكل سليم (أرقام فقط).')]);
          return;
        }

        // Verify mediator exists in server
        const targetUser = await interaction.client.users.fetch(accusedMediatorId).catch(() => null);
        if (!targetUser) {
          await safeEditReply(interaction, [buildErrorEmbed(this.config, '❌ تعذر العثور على مستخدم بهذا الآيدي في ديسكورد.')]);
          return;
        }

        // Determine mediator type (trial/trusted) if they are registered mediators
        const mediatorReg = await this.mediatorRepository.getMediator(accusedMediatorId).catch(() => null);
        const mediatorType = mediatorReg ? (mediatorReg.status === 'trusted' ? 'trusted' : 'new') : 'unknown';

        // Create complaint draft in DB (status: open by default, updated later)
        complaintRecord = await this.complaintRepository.createComplaint({
          user_id: interaction.user.id,
          mediator_id: accusedMediatorId,
          ticket_id: linkedTicketRecord ? (linkedTicketRecord.channel_id || linkedTicketRecord.id) : ticketInput,
          trade_value: tradeValue || (linkedTicketRecord?.metadata?.trade_value ? `$${linkedTicketRecord.metadata.trade_value}` : null),
          mediator_type: mediatorType,
          complaint_type: 'mediator',
          category,
          description,
          channel_id: null
        });

        complaintChannelName = `شكوى-وسيط-${complaintRecord.complaint_id}`;
      } else if (customId === 'complaint:modal:general') {
        complaintType = 'general';
        category = interaction.fields.getTextInputValue('title');
        description = interaction.fields.getTextInputValue('description');

        complaintRecord = await this.complaintRepository.createComplaint({
          user_id: interaction.user.id,
          mediator_id: null,
          ticket_id: linkedTicketRecord ? (linkedTicketRecord.channel_id || linkedTicketRecord.id) : ticketInput,
          trade_value: null,
          mediator_type: null,
          complaint_type: 'general',
          category,
          description,
          channel_id: null
        });

        complaintChannelName = `شكوى-عامة-${complaintRecord.complaint_id}`;
      }

      if (!complaintRecord) {
        await safeEditReply(interaction, [buildErrorEmbed(this.config, '❌ حدث خطأ أثناء إنشاء سجل الشكوى.')]);
        return;
      }

      // Create private ticket channel for the complaint inside the category 1507928422100504576
      const channel = await guild.channels.create({
        name: complaintChannelName,
        type: 0, // GuildText
        parent: COMPLAINT_CATEGORY_ID,
        permissionOverwrites: [
          {
            id: guild.id,
            deny: [PermissionFlagsBits.ViewChannel]
          },
          {
            id: interaction.user.id,
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.SendMessages,
              PermissionFlagsBits.AttachFiles,
              PermissionFlagsBits.EmbedLinks
            ]
          },
          {
            id: ROLE_COMPENSATION,
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.SendMessages,
              PermissionFlagsBits.AttachFiles,
              PermissionFlagsBits.EmbedLinks
            ]
          },
          {
            id: guild.members.me!.id,
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.SendMessages,
              PermissionFlagsBits.AttachFiles,
              PermissionFlagsBits.EmbedLinks
            ]
          }
        ]
      }).catch((err) => {
        logger.error('Failed to create complaint channel', err);
        return null;
      });

      if (!channel) {
        await safeEditReply(interaction, [buildErrorEmbed(this.config, '❌ فشل إنشاء قنوات الشكاوى بالسيرفر، يرجى مراجعة صلاحيات البوت.')]);
        return;
      }

      // Update complaint record with channel ID
      await this.complaintRepository.updateComplaint(complaintRecord.complaint_id, {
        channel_id: channel.id
      }).catch(() => null);

      // Construct a single, premium, cohesive dashboard embed
      const dashboardEmbed = new EmbedBuilder()
        .setColor(hexToDecimal(this.config.bot.embedColor))
        .setTitle(`📢 تذكرة شكوى جديدة | #${complaintRecord.complaint_id}`)
        .setDescription(
          'مرحباً بك في تذكرة الشكوى الخاصة بك. يرجى اتباع التعليمات التالية لإتمام الشكوى:\n\n' +
          '⚠️ **خطوات إرفاق الأدلة وتأكيد الشكوى:**\n' +
          '1. قم برفع أي صور أو مقاطع فيديو أو روابط محادثات تدعم شكواك في هذه القناة.\n' +
          '2. بعد الانتهاء، اضغط على زر **"✅ تأكيد وإرسال الشكوى"** بالأسفل لحفظ الأدلة وإرسالها للمراجعة.\n\n' +
          '• **تنبيه:** لن يتم النظر في الشكوى حتى تقوم بالضغط على زر التأكيد.\n' +
          '• بعد التأكيد، سيتم تعطيل إمكانية الكتابة مؤقتاً لحين رد الإدارة.'
        )
        .addFields(
          { name: '👤 صاحب الشكوى (المشتكي)', value: `<@${interaction.user.id}> (\`${interaction.user.id}\`)`, inline: true },
          { name: '📁 نوع الشكوى', value: complaintType === 'mediator' ? '👤 على وسيط' : '📝 عامة / إدارية', inline: true },
          { name: 'رقم الشكوى', value: `#${complaintRecord.complaint_id}`, inline: true }
        );

      if (complaintType === 'mediator' && accusedMediatorId) {
        dashboardEmbed.addFields(
          { name: 'الوسيط المتهم', value: `<@${accusedMediatorId}>`, inline: true },
          { name: 'آيدي الوسيط', value: `\`${accusedMediatorId}\``, inline: true },
          { name: 'تصنيف المشكلة', value: category, inline: true }
        );
        if (tradeValue) {
          dashboardEmbed.addFields({ name: 'قيمة التريد / المفقودات', value: tradeValue, inline: true });
        }
      } else {
        dashboardEmbed.addFields({ name: 'عنوان الشكوى', value: category, inline: true });
      }

      if (linkedTicketRecord) {
        dashboardEmbed.addFields(
          { name: '🔗 التذكرة المرتبطة', value: `#${linkedTicketRecord.channel_name || 'غير معروف'} (\`#${padTicketNumber(linkedTicketRecord.ticket_number, this.config.naming.zeroPadLength)}\`)`, inline: true },
          { name: 'الوسيط المستلم للتذكرة', value: linkedTicketRecord.claimed_by ? `<@${linkedTicketRecord.claimed_by}>` : 'لم يتم الاستلام', inline: true }
        );

        const transcriptUrl = linkedTicketRecord.metadata?.transcript_url || null;
        if (transcriptUrl) {
          dashboardEmbed.addFields({ name: 'أرشيف المحادثة (Transcript)', value: `[اضغط هنا لعرض أرشيف التذكرة](${transcriptUrl})`, inline: false });
        }
      }

      dashboardEmbed.addFields({ name: '📝 تفاصيل المشكلة', value: description, inline: false })
        .setTimestamp();

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`complaint:btn:confirm_submit:${complaintRecord.complaint_id}`)
          .setLabel('✅ تأكيد وإرسال الشكوى النهائية')
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId(`complaint:btn:cancel_submit:${complaintRecord.complaint_id}`)
          .setLabel('❌ إلغاء الشكوى')
          .setStyle(ButtonStyle.Danger)
      );

      // Send the embed and components together as one single message in the ticket
      await channel.send({ embeds: [dashboardEmbed], components: [row] });

      await safeEditReply(interaction, [buildSuccessEmbed(this.config, 'تم إنشاء تذكرة الشكوى', `✅ تم إنشاء تذكرة الشكوى بنجاح: <#${channel.id}>\nيرجى التوجه إليها لرفع الأدلة وتأكيد الشكوى.`)]);
    } catch (err: any) {
      logger.error('Failed to create complaint channel/record', err);
      await safeEditReply(interaction, [buildErrorEmbed(this.config, `❌ فشل إنشاء تذكرة الشكوى: ${err.message}`)]);
    } finally {
      this.creatingUsers.delete(userId);
    }
  }

  /**
   * Handle the final complaint confirmation click.
   */
  public async handleConfirmSubmit(interaction: ButtonInteraction, complaintId: number): Promise<void> {
    if (!interaction.inCachedGuild()) return;
    const guild = interaction.guild!;
    const channel = interaction.channel as TextChannel;

    if (!(await safeDeferReply(interaction, `complaint_confirm:${complaintId}`))) {
      return;
    }

    let complaint = await this.complaintRepository.getComplaint(complaintId);
    if (!complaint) {
      // Fallback: look up by channel ID to recover records synced in the background
      complaint = await this.complaintRepository.getComplaintByChannelId(channel.id);
    }

    if (!complaint) {
      await safeEditReply(interaction, [buildErrorEmbed(this.config, '❌ تعذر العثور على سجل الشكوى.')]);
      return;
    }

    // Verify only the complainant can confirm
    if (interaction.user.id !== complaint.user_id) {
      await safeEditReply(interaction, [buildErrorEmbed(this.config, '❌ لا يمكنك تأكيد الشكوى لأنك لست صاحب الشكوى.')]);
      return;
    }

    // Scan last 100 messages for attachments and link URLs
    const messages = await channel.messages.fetch({ limit: 100 }).catch(() => null);
    const attachments: any[] = [];
    const linkEvidence: string[] = [];

    if (messages) {
      for (const msg of messages.values()) {
        // Collect Discord file attachments
        if (msg.attachments.size > 0) {
          attachments.push(...Array.from(msg.attachments.values()));
        }
        // Collect URLs written in message
        if (msg.content) {
          const urls = msg.content.match(/https?:\/\/[^\s]+/g);
          if (urls) linkEvidence.push(...urls);
        }
      }
    }

    if (attachments.length === 0 && linkEvidence.length === 0) {
      await safeEditReply(interaction, [buildErrorEmbed(this.config, '⚠️ يجب إرفاق أدلة (أرسل صوراً، فيديو، أو روابط في الشات) قبل الضغط على زر التأكيد وإرسال الشكوى.')]);
      return;
    }

    // Ephemeral processing update instead of channel.send
    await safeEditReply(interaction, [
      buildSuccessEmbed(this.config, '🔄 جاري حفظ الأدلة', 'جاري معالجة وإعادة رفع الأدلة إلى الأرشيف الدائم...')
    ]);

    try {
      const logChannel = await guild.channels.fetch(LOG_CHANNEL_ID).catch(() => null);
      let permanentUrls: string[] = [];

      if (attachments.length > 0 && isGuildTextChannelType(logChannel)) {
        // Forward attachments to log channel for permanent hosting
        const fileLogEmbed = new EmbedBuilder()
          .setColor(hexToDecimal(this.config.bot.successColor))
          .setTitle(`📸 أدلة شكوى جديدة #${complaint.complaint_id}`)
          .setDescription(`أدلة مرفقة بالشكوى المقدمة من <@${complaint.user_id}>`)
          .setTimestamp();

        const logMsg = await logChannel.send({
          embeds: [fileLogEmbed],
          files: attachments.map(att => att.url)
        });
        permanentUrls = logMsg.attachments.map(att => att.url);
      } else {
        permanentUrls = attachments.map(att => att.url);
      }

      // Map evidence array
      const evidenceList: ComplaintRecord['evidence'] = [
        ...attachments.map((att, index) => ({
          name: att.name,
          original_url: att.url,
          permanent_url: permanentUrls[index] || att.url,
          size: att.size,
          contentType: att.contentType || null
        })),
        ...linkEvidence.map(link => ({
          name: 'رابط خارجي',
          original_url: link,
          permanent_url: link,
          size: 0,
          contentType: 'url'
        }))
      ];

      // Update complaint in DB
      await this.complaintRepository.updateComplaint(complaint.complaint_id, {
        evidence: evidenceList,
        status: 'open'
      });

      // Increment mediator complaint count if accused
      if (complaint.complaint_type === 'mediator' && complaint.mediator_id) {
        const mediatorReg = await this.mediatorRepository.getMediator(complaint.mediator_id).catch(() => null);
        if (mediatorReg) {
          await this.mediatorRepository.updateMediator(complaint.mediator_id, {
            complaints_count: (mediatorReg.complaints_count || 0) + 1
          }).catch((err) => logger.error('Failed to increment mediator complaints count', err));
        }
      }

      // Lock channel for Complainant messages (prevent spam after finalization)
      await channel.permissionOverwrites.edit(complaint.user_id, {
        SendMessages: false,
        AttachFiles: false,
        EmbedLinks: false
      }).catch(() => null);

      // Edit original message in place (No new message is sent)
      const dashboardMsg = interaction.message;
      const originalEmbed = dashboardMsg.embeds[0];
      const finalEmbed = new EmbedBuilder()
        .setColor(hexToDecimal(this.config.bot.successColor))
        .setTitle('✅ تم إرسال وتأكيد الشكوى بنجاح')
        .setDescription(
          'تم تسجيل وتوثيق الشكوى والأدلة بنجاح.\n' +
          'تم تحويل الملف كاملاً إلى **فريق المراجعة والتعويضات** وسيتم دراسة الشكوى والتواصل معك في هذه القناة قريباً.\n\n' +
          '🔒 **تم إغلاق صلاحية الكتابة لك لحين رد الإدارة.**'
        )
        .addFields(originalEmbed.fields)
        .setTimestamp();

      if (evidenceList.length > 0) {
        const evidenceText = evidenceList.map((att: any, index: number) => `• [أدلة ملف ${index + 1}](${att.permanent_url}) (${att.name || 'بدون اسم'})`).join('\n');
        finalEmbed.addFields({ name: '📸 الأدلة المرفقة', value: evidenceText, inline: false });
      }

      const cancelRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`complaint:btn:cancel_submit:${complaint.complaint_id}`)
          .setLabel('❌ إلغاء الشكوى')
          .setStyle(ButtonStyle.Danger)
      );

      await dashboardMsg.edit({ embeds: [finalEmbed], components: [cancelRow] }).catch((err) => {
        logger.error('Failed to edit dashboard message to final state', err);
      });

      // Send Notification to logs and ping Compensation role
      if (isGuildTextChannelType(logChannel)) {
        const notifyEmbed = new EmbedBuilder()
          .setColor(hexToDecimal(this.config.bot.errorColor))
          .setTitle(`🚨 شكوى جديدة معلقة #${complaint.complaint_id}`)
          .setDescription(`تم تقديم شكوى جديدة تتطلب المراجعة الفورية.`)
          .addFields(
            { name: 'رقم الشكوى', value: `#${complaint.complaint_id}`, inline: true },
            { name: 'نوع الشكوى', value: complaint.complaint_type === 'mediator' ? '👤 على وسيط' : '📝 عامة / إدارية', inline: true },
            { name: 'صاحب الشكوى', value: `<@${complaint.user_id}>`, inline: true },
            { name: 'قناة الشكوى', value: `<#${channel.id}>`, inline: false }
          )
          .setTimestamp();

        if (complaint.complaint_type === 'mediator' && complaint.mediator_id) {
          notifyEmbed.addFields(
            { name: 'الوسيط المتهم', value: `<@${complaint.mediator_id}>`, inline: true },
            { name: 'رتبة الوسيط', value: complaint.mediator_type === 'trusted' ? 'وسيط مضمون' : 'وسيط جديد', inline: true }
          );
        }

        await logChannel.send({
          content: `<@&${ROLE_COMPENSATION}>`,
          embeds: [notifyEmbed]
        }).catch(() => null);
      }

      await safeEditReply(interaction, [buildSuccessEmbed(this.config, 'تم إرسال الشكوى', '✅ تم تأكيد الشكوى بنجاح.')]);
    } catch (err: any) {
      logger.error('Failed to confirm complaint', err);
      await safeEditReply(interaction, [buildErrorEmbed(this.config, `❌ فشل تأكيد الشكوى: ${err.message}`)]);
    }
  }

  /**
   * Handle the complaint cancellation click.
   */
  public async handleCancelSubmit(interaction: ButtonInteraction, complaintId: number): Promise<void> {
    if (!interaction.inCachedGuild()) return;
    const guild = interaction.guild!;
    const channel = interaction.channel as TextChannel;

    if (!(await safeDeferReply(interaction, `complaint_cancel:${complaintId}`))) {
      return;
    }

    let complaint = await this.complaintRepository.getComplaint(complaintId);
    if (!complaint) {
      complaint = await this.complaintRepository.getComplaintByChannelId(channel.id);
    }

    if (!complaint) {
      await safeEditReply(interaction, [buildErrorEmbed(this.config, '❌ تعذر العثور على سجل الشكوى.')]);
      return;
    }

    // Verify only the complainant or the main admin (1397364822152315052) can cancel
    const isMainAdmin = interaction.user.id === '1397364822152315052';
    if (interaction.user.id !== complaint.user_id && !isMainAdmin) {
      await safeEditReply(interaction, [buildErrorEmbed(this.config, '❌ لا يمكنك إلغاء الشكوى لأنك لست صاحب الشكوى أو الإداري المسؤول.')]);
      return;
    }

    // Update status to solved (cancelled) in DB/cache so it is not active anymore
    await this.complaintRepository.updateComplaint(complaint.complaint_id, {
      status: 'solved',
      resolution_notes: 'تم إلغاء الشكوى من قبل المشتكي قبل التأكيد.'
    }).catch((err) => logger.error('Failed to update complaint on cancellation', err));

    await safeEditReply(interaction, [buildSuccessEmbed(this.config, 'تم إلغاء الشكوى', '✅ جاري إغلاق وحذف القناة خلال ثوانٍ...')]);

    // Schedule channel deletion after 3 seconds
    setTimeout(() => {
      channel.delete().catch((err) => logger.error('Failed to delete complaint channel on cancellation', err));
    }, 3000);
  }

  /**
   * Handle the "إلغاء / إغلاق شكوى" button click from control panel.
   */
  public async handleCloseComplaintClick(interaction: ButtonInteraction): Promise<void> {
    const modal = new ModalBuilder()
      .setCustomId('ctrl_panel:modal:close_complaint')
      .setTitle('إلغاء أو إغلاق شكوى نشطة');

    modal.addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('complaint_id')
          .setLabel('رقم الشكوى (Complaint ID)')
          .setPlaceholder('مثال: 12')
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
      ),
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('notes')
          .setLabel('سبب الإلغاء أو ملاحظات الإجراء المتخذ')
          .setPlaceholder('اكتب تفاصيل الإجراء أو سبب الإغلاق هنا')
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(true)
      )
    );

    await safeShowModal(interaction, modal, 'ctrl_panel_close_complaint_modal');
  }

  /**
   * Handle the close complaint modal submit.
   */
  public async handleCloseComplaintModalSubmit(interaction: ModalSubmitInteraction): Promise<void> {
    if (!interaction.inCachedGuild()) return;
    const guild = interaction.guild!;

    await safeDeferReply(interaction, 'ctrl_panel_close_complaint_submit');

    const complaintIdStr = interaction.fields.getTextInputValue('complaint_id');
    const complaintId = parseInt(complaintIdStr, 10);
    const notes = interaction.fields.getTextInputValue('notes') || '';

    if (isNaN(complaintId)) {
      await safeEditReply(interaction, [buildErrorEmbed(this.config, '❌ رقم الشكوى غير صحيح. يرجى إدخال رقم صحيح (أرقام فقط).')]);
      return;
    }

    const complaint = await this.complaintRepository.getComplaint(complaintId);
    if (!complaint) {
      await safeEditReply(interaction, [buildErrorEmbed(this.config, `❌ تعذر العثور على الشكوى رقم #${complaintId} بقاعدة البيانات.`)]);
      return;
    }

    // Update status to solved in DB/cache
    await this.complaintRepository.updateComplaint(complaint.complaint_id, {
      status: 'solved',
      resolution_notes: notes || 'تم الإغلاق بواسطة الإدارة عبر لوحة التحكم.',
      handled_by: interaction.user.id
    }).catch((err) => logger.error('Failed to update complaint on admin close', err));

    // Update state in complaint channel if it exists
    if (complaint.channel_id) {
      const complChannel = await guild.channels.fetch(complaint.channel_id).catch(() => null);
      if (complChannel && isGuildTextChannelType(complChannel)) {
        const textChannel = complChannel as TextChannel;
        const closeEmbed = new EmbedBuilder()
          .setColor(hexToDecimal(this.config.bot.successColor))
          .setTitle('🚨 تم إغلاق / إلغاء الشكوى من الإدارة')
          .addFields(
            { name: 'رقم الشكوى', value: `#${complaint.complaint_id}`, inline: true },
            { name: 'الإجراء المتخذ', value: '✅ تم الإغلاق والحل (Closed / Solved)', inline: true },
            { name: 'المسؤول المعالج', value: `<@${interaction.user.id}>`, inline: true },
            { name: 'ملاحظات الإجراء الإداري', value: notes || 'لم يتم إضافة ملاحظات.', inline: false }
          )
          .setTimestamp();

        await textChannel.send({ embeds: [closeEmbed] }).catch(() => null);
        await textChannel.send({ content: '🔒 **تم إغلاق التذكرة رسمياً، وسيتم حذف هذه القناة خلال ثوانٍ...**' }).catch(() => null);

        // Delete channel after 5 seconds
        setTimeout(() => {
          textChannel.delete().catch((err) => logger.error('Failed to delete complaint channel on admin close', err));
        }, 5000);
      }
    }

    await safeEditReply(interaction, [buildSuccessEmbed(this.config, 'تم إغلاق الشكوى بنجاح', `✅ تم إغلاق الشكوى رقم #${complaint.complaint_id} بنجاح وتحديث حالتها في النظام.`)]);
  }
}
