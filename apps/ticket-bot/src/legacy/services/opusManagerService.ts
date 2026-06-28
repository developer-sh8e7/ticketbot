import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  MessageFlags,
  type ButtonInteraction,
  type ChatInputCommandInteraction,
  type Client,
  type Message,
  type TextBasedChannel,
} from 'discord.js';
import { CHECK_BUTTON_PREFIXES, TRIAL_BUTTON_IDS } from '../constants/customIds.js';
import { OpusRepository, type ProductType, type SubscriptionRecord, type TrialRecord } from '../database/opusRepository.js';
import { logger } from '../utils/logger.js';

const OPUS_COLOR = 2303786;
const PRODUCT_TYPES = ['ticket', 'system', 'verify', 'custom', 'web'] as const;

function fmt(value: string | null | undefined): string {
  return value && value.trim() ? value : 'غير متوفر';
}

function asProductType(value: string | null): ProductType {
  return PRODUCT_TYPES.includes(value as ProductType) ? value as ProductType : 'ticket';
}

function plusDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

function plusHours(date: Date, hours: number): Date {
  return new Date(date.getTime() + hours * 60 * 60 * 1000);
}

export class OpusManagerService {
  public constructor(
    private readonly repository: OpusRepository,
    private readonly managerId: string,
    private readonly notifyChannelId: string,
  ) {}

  private isManager(userId: string): boolean {
    return userId === this.managerId;
  }

  private managerOnlyEmbed(command = false): EmbedBuilder {
    return new EmbedBuilder()
      .setColor(0xef4444)
      .setDescription(command
        ? '❌ هذا الأمر مخصص لمسؤول التجارب فقط.'
        : '❌ هذا الإجراء مخصص لمسؤول التجارب فقط.\nإذا تحتاج متابعة طلبك، انتظر رد الإدارة داخل التذكرة.');
  }

  public buildTrialInfoEmbed(): EmbedBuilder {
    return new EmbedBuilder()
      .setColor(OPUS_COLOR)
      .setTitle('🎁 التجربة المجانية — Free Trial')
      .setDescription('تقدر تجرب أحد منتجات Opus Solutions قبل الشراء وتشوف الجودة بنفسك داخل سيرفرك.')
      .addFields(
        { name: '📌 وش هي التجربة؟', value: 'التجربة المجانية تعطيك فرصة تستخدم نسخة محدودة من أحد منتجاتنا داخل سيرفرك قبل ما تشتري النسخة الكاملة.' },
        { name: '⏳ مدة التجربة', value: 'مدة التجربة: أسبوعين كاملين من وقت التفعيل.' },
        { name: '🛠️ الدعم الفني', value: 'الدعم الفني المجاني متاح لمدة 48 ساعة فقط من بداية التجربة.' },
        { name: '🌐 شروط السيرفر', value: 'التجربة تكون على سيرفر واحد فقط، ولا يمكن نقلها أو تكرارها على أكثر من سيرفر.' },
        { name: '🔒 الميزات المحدودة', value: 'التجربة تشمل الميزات الأساسية فقط.\nبعض الميزات المتقدمة غير متوفرة في التجربة، مثل ميزة الذكاء الاصطناعي، لأنها متاحة فقط في النسخة المدفوعة.' },
        { name: '⚠️ شروط مهمة', value: '- التجربة متاحة مرة واحدة لكل سيرفر.\n- لا يمكن بيع أو نقل التجربة لشخص آخر.\n- يحق للإدارة رفض أو إيقاف التجربة عند إساءة الاستخدام.' },
        { name: '🎫 طريقة الطلب', value: 'افتح تكت واختر:\n🎁 تجربة مجانية\n\nثم اكتب المنتج اللي تبي تجربه.' },
      )
      .setFooter({ text: 'Opus Solutions • جرّب قبل ما تشتري' });
  }

  public async handleKeywordMessage(message: Message): Promise<boolean> {
    if (message.author.bot || !message.inGuild()) return false;
    const content = message.content.trim();
    if (!['تجربة', 'trial', 'Trial', 'TRIAL'].includes(content)) return false;
    await message.reply({ embeds: [this.buildTrialInfoEmbed()] }).catch((error) => {
      logger.warn('Failed to reply with trial info embed', error instanceof Error ? error.message : error);
    });
    return true;
  }

  public async handleTrialAccept(interaction: ButtonInteraction): Promise<void> {
    if (!this.isManager(interaction.user.id)) {
      await interaction.reply({ embeds: [this.managerOnlyEmbed()], flags: MessageFlags.Ephemeral });
      return;
    }

    const embed = new EmbedBuilder()
      .setColor(OPUS_COLOR)
      .setTitle('✅ تم قبول التجربة المجانية')
      .setDescription('تم قبول طلب التجربة المجانية لهذا السيرفر.\nسيتم تفعيل النسخة التجريبية حسب توفر المنتج وبعد مراجعة بيانات السيرفر.')
      .addFields(
        { name: '📌 مدة التجربة', value: 'أسبوعين كاملين من وقت التفعيل.' },
        { name: '🛠️ الدعم الفني', value: 'الدعم الفني المجاني متاح لمدة 48 ساعة فقط من بداية التجربة.' },
        { name: '🌐 السيرفر المسموح', value: 'التجربة تكون على سيرفر واحد فقط ولا يمكن نقلها لسيرفر آخر.' },
        { name: '⚠️ ملاحظات مهمة', value: '- التجربة تشمل ميزات محدودة.\n- ميزة الذكاء الاصطناعي غير متوفرة في التجربة المجانية.\n- لا يتم تسليم ملفات السورس كود.\n- التجربة متاحة مرة واحدة لكل سيرفر.\n- النسخة الكاملة تكون عند الشراء فقط.' },
      )
      .setFooter({ text: 'Opus Solutions • Free Trial' });

    await interaction.reply({ embeds: [embed] });
    await this.repository.logEvent({
      userId: interaction.user.id,
      guildId: interaction.guildId,
      eventType: 'trial_accepted_button',
      eventMessage: 'Trial accept button was pressed inside a trial ticket.',
      metadata: { channel_id: interaction.channelId },
    }).catch(() => null);
  }

  public async handleTrialReject(interaction: ButtonInteraction): Promise<void> {
    if (!this.isManager(interaction.user.id)) {
      await interaction.reply({ embeds: [this.managerOnlyEmbed()], flags: MessageFlags.Ephemeral });
      return;
    }

    const embed = new EmbedBuilder()
      .setColor(OPUS_COLOR)
      .setTitle('❌ تم رفض التجربة المجانية')
      .setDescription('نعتذر، تم رفض طلب التجربة المجانية لهذا السيرفر.')
      .addFields(
        { name: '📌 السبب', value: 'يمكن أن يكون الرفض بسبب عدم توفر المنتج حالياً، أو عدم تطابق شروط التجربة، أو وجود تجربة سابقة لنفس السيرفر.' },
        { name: '🎫 تقدر تتواصل معنا', value: 'إذا عندك استفسار أو تبي تطلب المنتج بشكل مدفوع، افتح تكت من الدعم.' },
      )
      .setFooter({ text: 'Opus Solutions • Free Trial' });

    await interaction.reply({ embeds: [embed] });
    await this.repository.logEvent({
      userId: interaction.user.id,
      guildId: interaction.guildId,
      eventType: 'trial_rejected',
      eventMessage: 'Trial reject button was pressed inside a trial ticket.',
      metadata: { channel_id: interaction.channelId },
    }).catch(() => null);
  }

  public async handleTrialCommand(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!this.isManager(interaction.user.id)) {
      await interaction.reply({ embeds: [this.managerOnlyEmbed(true)], flags: MessageFlags.Ephemeral });
      return;
    }

    const userId = interaction.options.getString('user_id', true);
    const guildId = interaction.options.getString('guild_id', true);
    const productType = asProductType(interaction.options.getString('product_type'));
    const guildName = interaction.options.getString('guild_name') || null;
    const botInstanceId = interaction.options.getString('bot_instance_id') || null;

    const existing = await this.repository.findTrialByUserOrGuild(userId, guildId);
    if (existing) {
      const embed = new EmbedBuilder()
        .setColor(OPUS_COLOR)
        .setTitle('⚠️ تجربة موجودة مسبقاً')
        .setDescription('هذا الشخص أو السيرفر مسجل عنده تجربة مجانية من قبل.')
        .addFields(
          { name: 'الشخص', value: fmt(existing.user_id), inline: true },
          { name: 'السيرفر', value: fmt(existing.guild_id), inline: true },
          { name: 'الحالة', value: fmt(existing.status), inline: true },
          { name: 'تاريخ البداية', value: fmt(existing.starts_at), inline: true },
          { name: 'تاريخ الانتهاء', value: fmt(existing.expires_at), inline: true },
          { name: 'نهاية الدعم الفني', value: fmt(existing.support_ends_at), inline: true },
        );
      await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
      return;
    }

    const startsAt = new Date();
    const trial = await this.repository.createTrial({
      userId,
      guildId,
      guildName,
      ownerId: userId,
      productType,
      botInstanceId,
      acceptedBy: this.managerId,
      startsAt,
      expiresAt: plusDays(startsAt, 14),
      supportEndsAt: plusHours(startsAt, 48),
    });

    await this.repository.logEvent({
      botInstanceId,
      userId,
      guildId,
      eventType: 'trial_created',
      eventMessage: 'Trial created from /trial command.',
      metadata: { trial_id: trial.id },
    }).catch(() => null);

    await interaction.reply({
      flags: MessageFlags.Ephemeral,
      embeds: [new EmbedBuilder()
        .setColor(OPUS_COLOR)
        .setTitle('✅ تم تسجيل التجربة')
        .setDescription('تم تسجيل التجربة المجانية بنجاح.')
        .addFields(
          { name: '👤 الشخص', value: userId, inline: true },
          { name: '🌐 السيرفر', value: guildId, inline: true },
          { name: '📦 المنتج', value: productType, inline: true },
          { name: '⏳ مدة التجربة', value: 'أسبوعين كاملين', inline: true },
          { name: '🛠️ الدعم الفني', value: '48 ساعة فقط', inline: true },
          { name: '📅 تنتهي التجربة', value: trial.expires_at, inline: false },
        )
        .setFooter({ text: 'Opus Solutions • Trial System' })],
    });
  }

  public async handleSubscriptionCommand(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!this.isManager(interaction.user.id)) {
      await interaction.reply({ embeds: [this.managerOnlyEmbed(true)], flags: MessageFlags.Ephemeral });
      return;
    }

    const userId = interaction.options.getString('user_id', true);
    const guildId = interaction.options.getString('guild_id', true);
    const productType = asProductType(interaction.options.getString('product_type'));
    const durationDays = interaction.options.getInteger('duration_days') ?? 30;
    const guildName = interaction.options.getString('guild_name') || null;
    const botInstanceId = interaction.options.getString('bot_instance_id') || null;
    const planName = interaction.options.getString('plan_name') || 'monthly';
    const startsAt = new Date();

    const sub = await this.repository.createSubscription({
      userId,
      guildId,
      guildName,
      ownerId: userId,
      productType,
      botInstanceId,
      planName,
      createdBy: this.managerId,
      startsAt,
      expiresAt: plusDays(startsAt, durationDays),
    });

    await this.repository.logEvent({ botInstanceId, userId, guildId, eventType: 'subscription_created', eventMessage: 'Subscription created from /subscription command.', metadata: { subscription_id: sub.id } }).catch(() => null);

    await interaction.reply({ flags: MessageFlags.Ephemeral, embeds: [new EmbedBuilder()
      .setColor(OPUS_COLOR)
      .setTitle('✅ تم تسجيل الاشتراك')
      .addFields(
        { name: '👤 العميل', value: userId, inline: true },
        { name: '🌐 السيرفر', value: guildId, inline: true },
        { name: '📦 المنتج', value: productType, inline: true },
        { name: '💳 الباقة', value: planName, inline: true },
        { name: '📅 البداية', value: sub.starts_at, inline: true },
        { name: '⏳ النهاية', value: sub.expires_at, inline: true },
      )] });
  }

  public async handleCheckCommand(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!this.isManager(interaction.user.id)) {
      await interaction.reply({ embeds: [this.managerOnlyEmbed(true)], flags: MessageFlags.Ephemeral });
      return;
    }

    const id = interaction.options.getString('id', true);
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId(`${CHECK_BUTTON_PREFIXES.user}${id}:${interaction.user.id}`).setLabel('تأكد من الشخص').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(`${CHECK_BUTTON_PREFIXES.guild}${id}:${interaction.user.id}`).setLabel('تأكد من السيرفر').setStyle(ButtonStyle.Secondary),
    );
    await interaction.reply({ content: 'اختر نوع الفحص:', components: [row], flags: MessageFlags.Ephemeral });
  }

  public async handleCheckButton(interaction: ButtonInteraction): Promise<void> {
    const [prefix, type] = interaction.customId.startsWith(CHECK_BUTTON_PREFIXES.user)
      ? [CHECK_BUTTON_PREFIXES.user, 'user' as const]
      : [CHECK_BUTTON_PREFIXES.guild, 'guild' as const];
    const raw = interaction.customId.slice(prefix.length);
    const [id, requesterId] = raw.split(':');
    if (interaction.user.id !== requesterId) {
      await interaction.reply({ content: '❌ هذا الفحص لا يخصك.', flags: MessageFlags.Ephemeral });
      return;
    }

    const trial = type === 'user' ? await this.repository.findTrialByUser(id) : await this.repository.findTrialByGuild(id);
    const sub = type === 'user' ? await this.repository.findSubscriptionByUser(id) : await this.repository.findSubscriptionByGuild(id);
    const record = trial ?? sub;

    if (!record) {
      await interaction.reply({ flags: MessageFlags.Ephemeral, embeds: [new EmbedBuilder()
        .setColor(OPUS_COLOR)
        .setTitle(type === 'user' ? '✅ لا توجد تجربة أو اشتراك لهذا الشخص' : '✅ لا توجد تجربة أو اشتراك لهذا السيرفر')
        .setDescription(type === 'user' ? 'هذا الشخص غير مسجل في نظام التجارب أو الاشتراكات.' : 'هذا السيرفر غير مسجل في نظام التجارب أو الاشتراكات.')] });
      return;
    }

    const isTrial = Boolean(trial);
    const embed = new EmbedBuilder()
      .setColor(OPUS_COLOR)
      .setTitle(type === 'user' ? '✅ هذا الشخص لديه سجل' : '✅ هذا السيرفر لديه سجل')
      .addFields(
        { name: type === 'user' ? '👤 الشخص' : '🌐 السيرفر', value: id, inline: true },
        { name: type === 'user' ? '🌐 السيرفر المرتبط' : '👤 الشخص المرتبط', value: fmt(record.guild_id), inline: true },
        { name: '📦 المنتج', value: fmt(record.product_type), inline: true },
        { name: '📌 النوع', value: isTrial ? 'Trial' : 'Paid', inline: true },
        { name: '📌 الحالة', value: fmt(record.status), inline: true },
        { name: '📅 تاريخ البداية', value: fmt(record.starts_at), inline: true },
        { name: '⏳ نهاية المدة', value: fmt(record.expires_at), inline: true },
        { name: '🛠️ نهاية الدعم الفني', value: fmt(record.support_ends_at), inline: true },
      )
      .setFooter({ text: 'Opus Solutions • Trial Check' });
    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  }

  public async checkExpiry(client: Client): Promise<void> {
    const [trials, subscriptions] = await Promise.all([
      this.repository.findExpiredTrials(),
      this.repository.findExpiredSubscriptions(),
    ]);

    for (const trial of trials) {
      await this.notifyExpiredTrial(client, trial);
      await this.repository.markTrialExpired(trial.id);
      await this.repository.logEvent({ botInstanceId: trial.bot_instance_id, userId: trial.user_id, guildId: trial.guild_id, eventType: 'trial_expired', eventMessage: 'Trial expired and was notified.', metadata: { trial_id: trial.id } }).catch(() => null);
    }

    for (const sub of subscriptions) {
      await this.notifyExpiredSubscription(client, sub);
      await this.repository.markSubscriptionExpired(sub.id);
      await this.repository.logEvent({ botInstanceId: sub.bot_instance_id, userId: sub.user_id, guildId: sub.guild_id, eventType: 'subscription_expired', eventMessage: 'Subscription expired and was notified.', metadata: { subscription_id: sub.id } }).catch(() => null);
    }
  }

  private async sendNotify(client: Client, embed: EmbedBuilder, ownerId?: string | null): Promise<void> {
    const channel = await client.channels.fetch(this.notifyChannelId).catch(() => null) as TextBasedChannel | null;
    if (channel?.isSendable()) {
      await channel.send({ content: ownerId ? `<@${ownerId}>` : undefined, embeds: [embed], allowedMentions: { users: ownerId ? [ownerId] : [] } }).catch(() => null);
    }
  }

  private async sendOwnerDm(client: Client, ownerId: string | null | undefined, embed: EmbedBuilder): Promise<void> {
    if (!ownerId) return;
    const user = await client.users.fetch(ownerId).catch(() => null);
    if (!user) return;
    await user.send({ embeds: [embed] }).catch(async () => {
      await this.repository.logEvent({ userId: ownerId, eventType: 'dm_failed', eventMessage: 'Failed to send expiry DM.', metadata: {} }).catch(() => null);
    });
  }

  private async notifyExpiredTrial(client: Client, trial: TrialRecord): Promise<void> {
    const embed = new EmbedBuilder()
      .setColor(OPUS_COLOR)
      .setTitle('⏳ انتهت تجربة مجانية')
      .addFields(
        { name: 'السيرفر', value: fmt(trial.guild_name), inline: true },
        { name: 'آيدي السيرفر', value: fmt(trial.guild_id), inline: true },
        { name: 'صاحب السيرفر', value: trial.owner_id ? `<@${trial.owner_id}>` : 'غير متوفر', inline: true },
        { name: 'آيدي صاحب السيرفر', value: fmt(trial.owner_id), inline: true },
        { name: 'المنتج', value: fmt(trial.product_type), inline: true },
        { name: 'نوع الخدمة', value: 'Free Trial', inline: true },
        { name: 'بدأت التجربة', value: fmt(trial.starts_at), inline: true },
        { name: 'انتهت التجربة', value: fmt(trial.expires_at), inline: true },
        { name: 'انتهى الدعم الفني', value: fmt(trial.support_ends_at), inline: true },
        { name: 'الحالة', value: 'Expired', inline: true },
        { name: 'الإجراء', value: 'تم تعطيل الخدمة أو إيقاف البوت حسب النظام.', inline: false },
      )
      .setFooter({ text: 'Opus Solutions • Expiry System' });
    await this.sendNotify(client, embed, trial.owner_id);
    await this.sendOwnerDm(client, trial.owner_id, new EmbedBuilder()
      .setColor(OPUS_COLOR)
      .setTitle('⏳ انتهت تجربتك المجانية')
      .setDescription('انتهت التجربة المجانية الخاصة بمنتج Opus Solutions.')
      .addFields(
        { name: '📦 المنتج', value: fmt(trial.product_type) },
        { name: '🌐 السيرفر', value: fmt(trial.guild_name) },
        { name: '📅 تاريخ الانتهاء', value: fmt(trial.expires_at) },
        { name: '🎫 التجديد', value: 'إذا حاب تفعّل المنتج بشكل دائم، افتح تكت شراء في سيرفر Opus Solutions.' },
      ));
  }

  private async notifyExpiredSubscription(client: Client, sub: SubscriptionRecord): Promise<void> {
    const embed = new EmbedBuilder()
      .setColor(OPUS_COLOR)
      .setTitle('💳 انتهى اشتراك مدفوع')
      .addFields(
        { name: 'السيرفر', value: fmt(sub.guild_name), inline: true },
        { name: 'آيدي السيرفر', value: fmt(sub.guild_id), inline: true },
        { name: 'صاحب السيرفر', value: sub.owner_id ? `<@${sub.owner_id}>` : 'غير متوفر', inline: true },
        { name: 'آيدي صاحب السيرفر', value: fmt(sub.owner_id), inline: true },
        { name: 'المنتج', value: fmt(sub.product_type), inline: true },
        { name: 'نوع الخدمة', value: 'Paid Subscription', inline: true },
        { name: 'الباقة', value: fmt(sub.plan_name), inline: true },
        { name: 'بدأ الاشتراك', value: fmt(sub.starts_at), inline: true },
        { name: 'انتهى الاشتراك', value: fmt(sub.expires_at), inline: true },
        { name: 'الحالة', value: 'Expired', inline: true },
        { name: 'الإجراء', value: 'تم تعطيل الخدمة أو إيقاف البوت حسب النظام.', inline: false },
      )
      .setFooter({ text: 'Opus Solutions • Subscription System' });
    await this.sendNotify(client, embed, sub.owner_id);
    await this.sendOwnerDm(client, sub.owner_id, new EmbedBuilder()
      .setColor(OPUS_COLOR)
      .setTitle('💳 انتهى اشتراكك')
      .setDescription('انتهى اشتراكك في أحد منتجات Opus Solutions.')
      .addFields(
        { name: '📦 المنتج', value: fmt(sub.product_type) },
        { name: '🌐 السيرفر', value: fmt(sub.guild_name) },
        { name: '📅 تاريخ الانتهاء', value: fmt(sub.expires_at) },
        { name: '🎫 التجديد', value: 'لتجديد الاشتراك، افتح تكت شراء في سيرفر Opus Solutions.' },
      ));
  }
}
