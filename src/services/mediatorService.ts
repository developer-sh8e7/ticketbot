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
  type TextChannel
} from 'discord.js';
import type { ConfigStore } from './configStore.js';
import { MediatorRepository, type MediatorRecord } from '../database/mediatorRepository.js';
import { logger } from '../utils/logger.js';
import { hexToDecimal } from '../utils/color.js';
import { safeReply, safeEditReply, safeDeferReply, safeShowModal } from '../utils/interaction.js';

// Mediator System constants
const ROLE_NEW_MEDIATOR = '1507642618157465600';     // وسيط جديد
const ROLE_TRUSTED_MEDIATOR = '1506010306407694346'; // وسيط مضمون
const ROLE_MEMBER = '1483237139637469417';           // STB | Member (Keep only this on removal)
const OWNER_ADMIN_ID = '1397364822152315052';       // Authorized Admin ID

export class MediatorService {
  public constructor(
    private readonly configStore: ConfigStore,
    private readonly mediatorRepository: MediatorRepository
  ) {}

  private get config() {
    return this.configStore.current;
  }

  /**
   * Check if a member has administrative permissions or is the authorized owner.
   */
  public isAdmin(member: GuildMember): boolean {
    if (member.id === OWNER_ADMIN_ID) return true;
    return member.permissions.has(PermissionFlagsBits.Administrator);
  }

  /**
   * Helper to parse User ID from copy-pasted string or mention.
   */
  private parseUserId(input: string): string | null {
    const cleaned = input.trim();
    const match = cleaned.match(/^<@!?(\d+)>$/);
    if (match) return match[1];
    if (/^\d+$/.test(cleaned)) return cleaned;
    return null;
  }

  /**
   * Sends the mediator management dashboard.
   */
  public async sendControlPanel(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!interaction.inCachedGuild()) return;
    const member = interaction.member as GuildMember;

    if (!this.isAdmin(member)) {
      await safeReply(interaction, [
        new EmbedBuilder()
          .setColor(hexToDecimal(this.config.bot.errorColor))
          .setTitle('❌ خطأ في الصلاحيات')
          .setDescription('عذراً، هذا الأمر مخصص للإدارة وأصحاب الصلاحيات العليا فقط.')
      ]);
      return;
    }

    const embed = new EmbedBuilder()
      .setColor(hexToDecimal(this.config.bot.embedColor))
      .setTitle('🛡️ لوحة التحكم وإدارة الوسطاء (Mediator Management)')
      .setDescription(
        'مرحباً بك في لوحة التحكم الكاملة بنظام الوسطاء.\n' +
        'يمكنك التحكم في الوسطاء، ترقيتهم، إزالتهم، ومتابعة سجلات النشاط بالكامل من هنا.'
      )
      .addFields(
        { name: '🟢 تعيين وسيط', value: 'إضافة عضو جديد كـ **وسيط جديد** (تجريبي) وإسناد رتبته.', inline: true },
        { name: '🔵 ترقية وسيط', value: 'ترقية وسيط تجريبي إلى رتبة **وسيط مضمون** معتمد.', inline: true },
        { name: '🔴 إزالة وسيط', value: 'سحب كافة رتب وصلاحيات الوساطة وإبقاء العضوية فقط.', inline: true },
        { name: '🔍 معلومات وسيط', value: 'عرض إحصائيات ونشاط وسيط معين بالتفصيل.', inline: true },
        { name: '📋 قائمة الوسطاء', value: 'عرض قائمة الوسطاء المسجلين وحالتهم الحالية.', inline: true },
        { name: '📜 سجلات التعيين والإزالات', value: 'عرض سجلات النشاط والتعيينات التاريخية للإدارة.', inline: true }
      )
      .setFooter({ text: 'لوحة إدارة الوسطاء • Steal the Brainrot' })
      .setTimestamp();

    const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('mm:btn:assign')
        .setLabel('تعيين وسيط جديد')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId('mm:btn:promote')
        .setLabel('ترقية إلى وسيط مضمون')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('mm:btn:remove')
        .setLabel('إزالة وسيط')
        .setStyle(ButtonStyle.Danger)
    );

    const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('mm:btn:view_info')
        .setLabel('عرض معلومات وسيط')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('mm:btn:list')
        .setLabel('عرض قائمة الوسطاء')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('mm:btn:history')
        .setLabel('عرض السجلات التاريخية')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('mm:btn:update_notes')
        .setLabel('تحديث ملاحظات وسيط')
        .setStyle(ButtonStyle.Secondary)
    );

    await interaction.reply({
      embeds: [embed],
      components: [row1, row2],
      flags: MessageFlags.Ephemeral
    }).catch(() => null);
  }

  /**
   * Handle mediator panel button clicks (shows modals for inputs).
   */
  public async handleButton(interaction: ButtonInteraction): Promise<void> {
    if (!interaction.inCachedGuild()) return;
    const member = interaction.member as GuildMember;

    if (!this.isAdmin(member)) {
      await interaction.reply({
        content: '❌ ليس لديك الصلاحية لاستخدام هذه اللوحة.',
        flags: MessageFlags.Ephemeral
      }).catch(() => null);
      return;
    }

    const customId = interaction.customId;

    if (customId === 'mm:btn:assign') {
      const modal = new ModalBuilder()
        .setCustomId('mm:modal:assign')
        .setTitle('تعيين وسيط جديد (تجريبي)');

      modal.addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId('user_id')
            .setLabel('آيدي العضو أو منشن العضو')
            .setPlaceholder('مثال: 1397364822152315052')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
        ),
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId('reason')
            .setLabel('سبب التعيين')
            .setPlaceholder('اكتب سبب اختيار هذا الشخص للوساطة')
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true)
        ),
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId('trial_period')
            .setLabel('مدة التجربة')
            .setPlaceholder('مثال: أسبوعين / شهر')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
        ),
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId('notes')
            .setLabel('ملاحظات الإدارة')
            .setPlaceholder('أي ملاحظات إضافية')
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(false)
        )
      );

      await safeShowModal(interaction, modal, 'mm:modal:assign');
      return;
    }

    if (customId === 'mm:btn:promote') {
      const modal = new ModalBuilder()
        .setCustomId('mm:modal:promote')
        .setTitle('الترقية إلى وسيط مضمون معتمد');

      modal.addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId('user_id')
            .setLabel('آيدي العضو أو منشن العضو للترقية')
            .setPlaceholder('مثال: 1397364822152315052')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
        )
      );

      await safeShowModal(interaction, modal, 'mm:modal:promote');
      return;
    }

    if (customId === 'mm:btn:remove') {
      const modal = new ModalBuilder()
        .setCustomId('mm:modal:remove')
        .setTitle('إزالة وسيط وسحب الرتب والصلاحيات');

      modal.addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId('user_id')
            .setLabel('آيدي العضو أو المنشن المراد إزالته')
            .setPlaceholder('مثال: 1397364822152315052')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
        ),
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId('reason')
            .setLabel('سبب الإزالة وسحب الصلاحيات')
            .setPlaceholder('اكتب سبب الاستبعاد والإنهاء')
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true)
        )
      );

      await safeShowModal(interaction, modal, 'mm:modal:remove');
      return;
    }

    if (customId === 'mm:btn:view_info') {
      const modal = new ModalBuilder()
        .setCustomId('mm:modal:view_info')
        .setTitle('عرض معلومات وإحصائيات وسيط');

      modal.addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId('user_id')
            .setLabel('آيدي العضو أو منشن العضو')
            .setPlaceholder('اكتب آيدي العضو المراد جلب بياناته')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
        )
      );

      await safeShowModal(interaction, modal, 'mm:modal:view_info');
      return;
    }

    if (customId === 'mm:btn:update_notes') {
      const modal = new ModalBuilder()
        .setCustomId('mm:modal:update_notes')
        .setTitle('تحديث ملاحظات وسيط');

      modal.addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId('user_id')
            .setLabel('آيدي العضو أو منشن العضو')
            .setPlaceholder('اكتب آيدي الوسيط لتحديث ملاحظاته')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
        ),
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId('notes')
            .setLabel('الملاحظات الجديدة للوسيط')
            .setPlaceholder('اكتب الملاحظات الإدارية المحدثة هنا')
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true)
        )
      );

      await safeShowModal(interaction, modal, 'mm:modal:update_notes');
      return;
    }

    if (customId === 'mm:btn:list') {
      await safeDeferReply(interaction, 'mm_list_defer');
      const list = await this.mediatorRepository.listMediators();
      
      const active = list.filter(m => m.status !== 'removed');
      
      const embed = new EmbedBuilder()
        .setColor(hexToDecimal(this.config.bot.embedColor))
        .setTitle('📋 قائمة وسطاء السيرفر الحاليين')
        .setDescription(active.length === 0 ? '❌ لا يوجد وسطاء مسجلون حالياً.' : `يوجد حالياً **${active.length}** وسيط مسجل نشط:`)
        .setTimestamp();

      for (const med of active) {
        const statusIcon = med.status === 'trusted' ? '🏆 وسيط مضمون' : '⚙️ وسيط جديد (تجريبي)';
        embed.addFields({
          name: `👤 ${med.username} (\`${med.user_id}\`)`,
          value:
            `• **الرتبة**: ${statusIcon}\n` +
            `• **بواسطة**: <@${med.assigned_by}>\n` +
            `• **التذاكر المستلمة**: \`${med.tickets_claimed}\` | **المكتملة**: \`${med.tickets_completed}\`\n` +
            `• **مدة التجربة**: \`${med.trial_period || 'غير محددة'}\`\n` +
            `• **الشكاوى**: \`${med.complaints_count}\``
        });
      }

      await safeEditReply(interaction, [embed]);
      return;
    }

    if (customId === 'mm:btn:history') {
      await safeDeferReply(interaction, 'mm_history_defer');
      const history = await this.mediatorRepository.listHistory();
      const recent = history.slice(0, 10); // Show last 10 records

      const embed = new EmbedBuilder()
        .setColor(hexToDecimal(this.config.bot.embedColor))
        .setTitle('📜 سجل الإجراءات الإدارية الأخير للوسطاء')
        .setDescription(recent.length === 0 ? '❌ لا توجد سجلات تاريخية بعد.' : `آخر **${recent.length}** عملية مسجلة:`)
        .setTimestamp();

      for (const log of recent) {
        let actionEmoji = '⚙️';
        let actionText: string = log.action;
        if (log.action === 'assign') {
          actionEmoji = '🟢 تعيين';
          actionText = 'تعيين وسيط جديد';
        } else if (log.action === 'promote') {
          actionEmoji = '🏆 ترقية';
          actionText = 'ترقية لوسيط مضمون';
        } else if (log.action === 'remove') {
          actionEmoji = '🔴 إزالة';
          actionText = 'إزالة وسيط وسحب صلاحياته';
        } else if (log.action === 'update') {
          actionEmoji = '✍️ تحديث';
          actionText = 'تحديث ملاحظات';
        }

        embed.addFields({
          name: `${actionEmoji} - ${log.username}`,
          value:
            `• **الإجراء**: ${actionText}\n` +
            `• **بواسطة**: <@${log.actor_id}> (\`${log.actor_tag}\`)\n` +
            `• **السبب**: \`${log.reason || 'بدون سبب'}\`\n` +
            `• **التاريخ**: <t:${Math.floor(new Date(log.created_at).getTime() / 1000)}:F>`
        });
      }

      await safeEditReply(interaction, [embed]);
      return;
    }
  }

  /**
   * Handle modal submission events from the mediator dashboard.
   */
  public async handleModalSubmit(interaction: ModalSubmitInteraction): Promise<void> {
    if (!interaction.inCachedGuild()) return;
    const guild = interaction.guild!;
    const customId = interaction.customId;

    await safeDeferReply(interaction, `mm_modal_submit:${customId}`);

    const rawUserId = interaction.fields.getTextInputValue('user_id');
    const userId = this.parseUserId(rawUserId);

    if (!userId) {
      await safeEditReply(interaction, [
        new EmbedBuilder()
          .setColor(hexToDecimal(this.config.bot.errorColor))
          .setTitle('❌ معرف مستخدم غير صحيح')
          .setDescription('يرجى إدخال آيدي صحيح أو عمل منشن للمستخدم بشكل سليم (مثال: `1397364822152315052`).')
      ]);
      return;
    }

    // Try fetching target user
    const targetUser = await interaction.client.users.fetch(userId).catch(() => null);
    if (!targetUser) {
      await safeEditReply(interaction, [
        new EmbedBuilder()
          .setColor(hexToDecimal(this.config.bot.errorColor))
          .setTitle('❌ لم يتم العثور على العضو')
          .setDescription('تعذر العثور على مستخدم ديسكورد بهذا المعرف، يرجى التأكد من الآيدي.')
      ]);
      return;
    }

    const member = await guild.members.fetch(userId).catch(() => null);

    // 1. Assign New Mediator
    if (customId === 'mm:modal:assign') {
      const reason = interaction.fields.getTextInputValue('reason');
      const trialPeriod = interaction.fields.getTextInputValue('trial_period');
      const notes = interaction.fields.getTextInputValue('notes') || '';

      const existing = await this.mediatorRepository.getMediator(userId);
      if (existing && existing.status !== 'removed') {
        await safeEditReply(interaction, [
          new EmbedBuilder()
            .setColor(hexToDecimal(this.config.bot.errorColor))
            .setTitle('⚠️ العضو مسجل بالفعل')
            .setDescription(`العضو <@${userId}> مسجل بالفعل في نظام الوسطاء بحالة: **${existing.status === 'trusted' ? 'وسيط مضمون' : 'وسيط جديد'}**`)
        ]);
        return;
      }

      // Add role to member
      if (member) {
        // Ensure they don't have trusted role at the same time
        await member.roles.remove(ROLE_TRUSTED_MEDIATOR).catch(() => null);
        await member.roles.add(ROLE_NEW_MEDIATOR).catch((err) => {
          logger.error(`Failed to assign role ${ROLE_NEW_MEDIATOR} to ${userId}`, err);
        });
      }

      const mediator = await this.mediatorRepository.createMediator({
        user_id: userId,
        username: targetUser.username,
        status: 'trial',
        assigned_by: interaction.user.id,
        assigned_by_tag: interaction.user.tag,
        assigned_reason: reason,
        trial_period: trialPeriod,
        notes: notes
      });

      await this.mediatorRepository.logHistory({
        user_id: userId,
        username: targetUser.username,
        action: 'assign',
        actor_id: interaction.user.id,
        actor_tag: interaction.user.tag,
        reason: reason,
        details: { trial_period: trialPeriod, notes }
      });

      const logEmbed = new EmbedBuilder()
        .setColor(hexToDecimal(this.config.bot.successColor))
        .setTitle('🟢 تعيين وسيط جديد (تجريبي)')
        .addFields(
          { name: 'الوسيط المعين', value: `<@${userId}> (\`${targetUser.username}\`)`, inline: true },
          { name: 'المسؤول المعين', value: `${interaction.user} (\`${interaction.user.id}\`)`, inline: true },
          { name: 'مدة التجربة', value: trialPeriod, inline: true },
          { name: 'السبب', value: reason, inline: false }
        )
        .setTimestamp();
      if (notes) logEmbed.addFields({ name: 'ملاحظات إضافية', value: notes });

      await this.sendMediatorLog(guild, logEmbed);

      await safeEditReply(interaction, [
        new EmbedBuilder()
          .setColor(hexToDecimal(this.config.bot.successColor))
          .setTitle('✅ تم تعيين الوسيط بنجاح')
          .setDescription(`تم تسجيل <@${userId}> كـ **وسيط جديد** (تجريبي) وإسناد رتبة الوساطة بنجاح.`)
      ]);
      return;
    }

    // 2. Promote to Trusted Mediator
    if (customId === 'mm:modal:promote') {
      const existing = await this.mediatorRepository.getMediator(userId);
      if (!existing || existing.status === 'removed') {
        await safeEditReply(interaction, [
          new EmbedBuilder()
            .setColor(hexToDecimal(this.config.bot.errorColor))
            .setTitle('❌ غير مسجل')
            .setDescription(`العضو <@${userId}> غير مسجل كـ **وسيط جديد** في النظام لكي تتم ترقيته. يرجى تعيينه أولاً.`)
        ]);
        return;
      }

      if (existing.status === 'trusted') {
        await safeEditReply(interaction, [
          new EmbedBuilder()
            .setColor(hexToDecimal(this.config.bot.errorColor))
            .setTitle('⚠️ رتبته مضمونة بالفعل')
            .setDescription(`العضو <@${userId}> يحمل بالفعل رتبة **وسيط مضمون** ولا يحتاج لترقية.`)
        ]);
        return;
      }

      // Update roles
      if (member) {
        await member.roles.remove(ROLE_NEW_MEDIATOR).catch(() => null);
        await member.roles.add(ROLE_TRUSTED_MEDIATOR).catch((err) => {
          logger.error(`Failed to assign role ${ROLE_TRUSTED_MEDIATOR} to ${userId}`, err);
        });
      }

      await this.mediatorRepository.updateMediator(userId, {
        status: 'trusted',
        promoted_by: interaction.user.id,
        promoted_by_tag: interaction.user.tag,
        promoted_at: new Date().toISOString()
      });

      await this.mediatorRepository.logHistory({
        user_id: userId,
        username: targetUser.username,
        action: 'promote',
        actor_id: interaction.user.id,
        actor_tag: interaction.user.tag,
        reason: 'Promoted to Trusted Mediator',
        details: { previous_status: 'trial' }
      });

      const logEmbed = new EmbedBuilder()
        .setColor(0x3b82f6) // Blue
        .setTitle('🏆 ترقية وسيط إلى مضمون معتمد')
        .addFields(
          { name: 'الوسيط المترقي', value: `<@${userId}> (\`${targetUser.username}\`)`, inline: true },
          { name: 'المسؤول المُرقي', value: `${interaction.user} (\`${interaction.user.id}\`)`, inline: true }
        )
        .setTimestamp();

      await this.sendMediatorLog(guild, logEmbed);

      await safeEditReply(interaction, [
        new EmbedBuilder()
          .setColor(hexToDecimal(this.config.bot.successColor))
          .setTitle('✅ تمت ترقية الوسيط بنجاح')
          .setDescription(`تمت ترقية <@${userId}> بنجاح إلى رتبة **وسيط مضمون** معتمد وسحب رتبة التجريبي.`)
      ]);
      return;
    }

    // 3. Remove Mediator
    if (customId === 'mm:modal:remove') {
      const reason = interaction.fields.getTextInputValue('reason');

      const existing = await this.mediatorRepository.getMediator(userId);
      if (!existing || existing.status === 'removed') {
        await safeEditReply(interaction, [
          new EmbedBuilder()
            .setColor(hexToDecimal(this.config.bot.errorColor))
            .setTitle('❌ غير مسجل نشط')
            .setDescription(`العضو <@${userId}> غير مسجل كـ وسيط نشط في قاعدة البيانات حالياً.`)
        ]);
        return;
      }

      // Remove roles
      if (member) {
        // Find all roles to strip except ROLE_MEMBER
        const rolesToRemove = member.roles.cache.filter(role => 
          role.id !== guild.roles.everyone.id && 
          role.id !== ROLE_MEMBER
        );
        for (const [rId] of rolesToRemove) {
          await member.roles.remove(rId).catch(() => null);
        }
        // Ensure they have the member role
        if (!member.roles.cache.has(ROLE_MEMBER)) {
          await member.roles.add(ROLE_MEMBER).catch(() => null);
        }
      }

      await this.mediatorRepository.updateMediator(userId, {
        status: 'removed',
        is_active: false,
        removed_by: interaction.user.id,
        removed_by_tag: interaction.user.tag,
        removed_at: new Date().toISOString(),
        removed_reason: reason
      });

      await this.mediatorRepository.logHistory({
        user_id: userId,
        username: targetUser.username,
        action: 'remove',
        actor_id: interaction.user.id,
        actor_tag: interaction.user.tag,
        reason: reason,
        details: { previous_status: existing.status }
      });

      const logEmbed = new EmbedBuilder()
        .setColor(hexToDecimal(this.config.bot.errorColor))
        .setTitle('🔴 إزالة واستبعاد وسيط')
        .addFields(
          { name: 'الوسيط المستبعد', value: `<@${userId}> (\`${targetUser.username}\`)`, inline: true },
          { name: 'المسؤول المستبعد', value: `${interaction.user} (\`${interaction.user.id}\`)`, inline: true },
          { name: 'السبب', value: reason, inline: false }
        )
        .setTimestamp();

      await this.sendMediatorLog(guild, logEmbed);

      await safeEditReply(interaction, [
        new EmbedBuilder()
          .setColor(hexToDecimal(this.config.bot.successColor))
          .setTitle('✅ تم استبعاد الوسيط بنجاح')
          .setDescription(`تم سحب كافة رتب وصلاحيات الوساطة من <@${userId}> وتحديث قاعدة البيانات بالكامل.`)
      ]);
      return;
    }

    // 4. View Mediator Info
    if (customId === 'mm:modal:view_info') {
      const mediator = await this.mediatorRepository.getMediator(userId);

      if (!mediator) {
        await safeEditReply(interaction, [
          new EmbedBuilder()
            .setColor(hexToDecimal(this.config.bot.errorColor))
            .setTitle('❌ مستخدم غير مسجل')
            .setDescription(`لم يتم العثور على أي ملف وساطة مسجل للعضو <@${userId}> في قاعدة البيانات.`)
        ]);
        return;
      }

      const statusIcon = mediator.status === 'trusted'
        ? '🏆 وسيط مضمون معتمد'
        : mediator.status === 'trial'
          ? '⚙️ وسيط جديد (تجريبي)'
          : '❌ مستبعد / غير نشط';

      const durationText = this.formatDuration(new Date(mediator.assigned_at).getTime());

      const embed = new EmbedBuilder()
        .setColor(hexToDecimal(this.config.bot.embedColor))
        .setTitle(`👤 ملف وساطة: ${mediator.username}`)
        .setDescription(`البيانات والنشاط التاريخي الكامل للوسيط <@${userId}>:`)
        .addFields(
          { name: 'الآيدي الخاص به', value: `\`${mediator.user_id}\``, inline: true },
          { name: 'الحالة والرتبة', value: statusIcon, inline: true },
          { name: 'النشاط الفعلي', value: mediator.is_active ? '🟢 نشط حالياً' : '🔴 غير نشط', inline: true },
          { name: 'المسؤول المعين', value: `<@${mediator.assigned_by}>`, inline: true },
          { name: 'تاريخ التعيين', value: `<t:${Math.floor(new Date(mediator.assigned_at).getTime() / 1000)}:R>`, inline: true },
          { name: 'مدة الانضمام', value: durationText, inline: true }
        )
        .setTimestamp();

      if (mediator.promoted_at) {
        embed.addFields(
          { name: 'تاريخ الترقية', value: `<t:${Math.floor(new Date(mediator.promoted_at).getTime() / 1000)}:R>`, inline: true },
          { name: 'المسؤول المُرقي', value: `<@${mediator.promoted_by}>`, inline: true },
          { name: '\u200b', value: '\u200b', inline: true }
        );
      }

      embed.addFields(
        { name: '🎟️ التذاكر المستلمة', value: `\`${mediator.tickets_claimed}\` تذكرة`, inline: true },
        { name: '✅ التذاكر المكتملة', value: `\`${mediator.tickets_completed}\` تذكرة`, inline: true },
        { name: '⚠️ الشكاوى والتحذيرات', value: `\`${mediator.complaints_count}\` شكوى`, inline: true }
      );

      if (mediator.assigned_reason) {
        embed.addFields({ name: 'سبب التعيين', value: mediator.assigned_reason, inline: false });
      }

      if (mediator.notes) {
        embed.addFields({ name: 'ملاحظات الإدارة', value: mediator.notes, inline: false });
      }

      if (mediator.status === 'removed') {
        embed.addFields(
          { name: 'تاريخ الاستبعاد', value: `<t:${Math.floor(new Date(mediator.removed_at!).getTime() / 1000)}:F>`, inline: false },
          { name: 'بواسطة المسؤول', value: `<@${mediator.removed_by}>`, inline: true },
          { name: 'سبب الاستبعاد', value: mediator.removed_reason || 'غير مدون', inline: false }
        );
      }

      await safeEditReply(interaction, [embed]);
      return;
    }

    // 5. Update Notes
    if (customId === 'mm:modal:update_notes') {
      const notes = interaction.fields.getTextInputValue('notes');

      const existing = await this.mediatorRepository.getMediator(userId);
      if (!existing) {
        await safeEditReply(interaction, [
          new EmbedBuilder()
            .setColor(hexToDecimal(this.config.bot.errorColor))
            .setTitle('❌ غير مسجل')
            .setDescription(`العضو <@${userId}> غير مسجل بنظام الوسطاء، تعذر تحديث الملاحظات.`)
        ]);
        return;
      }

      await this.mediatorRepository.updateMediator(userId, { notes });

      await this.mediatorRepository.logHistory({
        user_id: userId,
        username: targetUser.username,
        action: 'update',
        actor_id: interaction.user.id,
        actor_tag: interaction.user.tag,
        reason: 'Updated mediator notes',
        details: { old_notes: existing.notes, new_notes: notes }
      });

      const logEmbed = new EmbedBuilder()
        .setColor(0x8b5cf6) // Purple
        .setTitle('✍️ تحديث ملاحظات وسيط')
        .addFields(
          { name: 'الوسيط', value: `<@${userId}> (\`${targetUser.username}\`)`, inline: true },
          { name: 'المسؤول المحدث', value: `${interaction.user} (\`${interaction.user.id}\`)`, inline: true },
          { name: 'الملاحظات الجديدة', value: notes, inline: false }
        )
        .setTimestamp();

      await this.sendMediatorLog(guild, logEmbed);

      await safeEditReply(interaction, [
        new EmbedBuilder()
          .setColor(hexToDecimal(this.config.bot.successColor))
          .setTitle('✅ تم التحديث بنجاح')
          .setDescription(`تم تحديث ملاحظات الوسيط <@${userId}> بنجاح بقاعدة البيانات.`)
      ]);
      return;
    }
  }

  /**
   * Helper to format membership duration.
   */
  private formatDuration(startTimeMs: number): string {
    const diffMs = Date.now() - startTimeMs;
    const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (days === 0) {
      const hours = Math.floor(diffMs / (1000 * 60 * 60));
      if (hours === 0) {
        const mins = Math.floor(diffMs / (1000 * 60));
        return `${mins} دقيقة`;
      }
      return `${hours} ساعة`;
    }
    return `${days} يوم`;
  }

  /**
   * Logs mediator action events to the configured log channel.
   */
  private async sendMediatorLog(guild: Guild, embed: EmbedBuilder): Promise<void> {
    const configChannelId = this.config.guild.mediatorLogChannelId;
    const targetChannelId = configChannelId && configChannelId.trim() !== ''
      ? configChannelId
      : '1486132662753034280'; // Fallback to main ticket logs channel

    const channel = await guild.channels.fetch(targetChannelId).catch(() => null);
    if (channel && channel.isTextBased()) {
      await (channel as TextChannel).send({ embeds: [embed] }).catch((err) => {
        logger.error(`Failed to send mediator log to channel ${targetChannelId}`, err);
      });
    }
  }
}
