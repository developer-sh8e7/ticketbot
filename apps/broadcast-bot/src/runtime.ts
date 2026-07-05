/**
 * Broadcast Bot runtime — DMs a message to server members via a short `!رسالة`
 * conversation, with a single live-updating progress embed.
 *
 * Runs one instance: logs in with BOT_TOKEN and serves GUILD_ID. The orchestrator
 * spawns this file as a child process per customer; the standalone index.ts uses
 * the same factory for the owner's own server.
 *
 * NOTE: mass-DMing members is against Discord ToS. This runtime mitigates the risk
 * (per-DM delay, skips bots, exclusion list, mandatory confirmation) but cannot
 * remove it. Enable the GuildMembers + MessageContent privileged intents for the
 * bot application in the Discord Developer Portal, or the flow will not work.
 */
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Client,
  ComponentType,
  EmbedBuilder,
  Events,
  GatewayIntentBits,
  Partials,
  PermissionFlagsBits,
  type GuildMember,
  type Message,
  type TextChannel,
} from 'discord.js';

const COMMAND = '!رسالة';
const COMMAND_ALIAS = '!broadcast';
const STEP_TIMEOUT_MS = 120_000; // how long each prompt waits for a reply
const DM_DELAY_MS = 1_200; // gap between DMs to reduce spam-flagging
const PROGRESS_EDIT_MS = 1_500; // min gap between progress-embed edits
const BAR_SEGMENTS = 20;
const ACCENT = 0x5865f2;
const OK = 0x22c55e;
const WARN = 0xf59e0b;
const ERR = 0xef4444;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Users who currently have an active broadcast session (one at a time each). */
const activeSessions = new Set<string>();

function progressBar(done: number, total: number): string {
  const ratio = total === 0 ? 0 : done / total;
  const filled = Math.round(ratio * BAR_SEGMENTS);
  const pct = Math.round(ratio * 100);
  return `${'▰'.repeat(filled)}${'▱'.repeat(BAR_SEGMENTS - filled)}  ${pct}%`;
}

function progressEmbed(opts: {
  done: number;
  sent: number;
  failed: number;
  total: number;
  lastTag: string | null;
  finished: boolean;
}): EmbedBuilder {
  const { done, sent, failed, total, lastTag, finished } = opts;
  const remaining = total - done;
  return new EmbedBuilder()
    .setColor(finished ? (failed > 0 ? WARN : OK) : ACCENT)
    .setTitle(finished ? '✅ اكتمل إرسال البرودكاست' : '📢 جاري إرسال البرودكاست...')
    .setDescription(`\`\`\`${progressBar(done, total)}\`\`\``)
    .addFields(
      { name: '✅ وصل', value: `**${sent}**`, inline: true },
      { name: '❌ فشل (خاص مقفل)', value: `**${failed}**`, inline: true },
      { name: '⏳ المتبقي', value: `**${remaining}**`, inline: true },
      { name: '👥 الإجمالي', value: `**${total}**`, inline: true },
      { name: '📨 آخر مستلم', value: lastTag ? `\`${lastTag}\`` : '—', inline: true },
    )
    .setTimestamp();
}

/** Wait for the author's next text message in the same channel; null on timeout. */
async function awaitReply(channel: TextChannel, authorId: string): Promise<Message | null> {
  try {
    const collected = await channel.awaitMessages({
      filter: (m) => m.author.id === authorId,
      max: 1,
      time: STEP_TIMEOUT_MS,
      errors: ['time'],
    });
    return collected.first() ?? null;
  } catch {
    return null;
  }
}

async function runFlow(trigger: Message): Promise<void> {
  const channel = trigger.channel as TextChannel;
  const author = trigger.author;
  const guild = trigger.guild;
  if (!guild) return;

  // 1) message body
  await channel.send({
    embeds: [
      new EmbedBuilder()
        .setColor(ACCENT)
        .setTitle('✍️ اكتب الرسالة')
        .setDescription('اكتب الآن الرسالة التي تريد إرسالها للأعضاء في الخاص.\n\n*لديك دقيقتان.*'),
    ],
  });
  const bodyMsg = await awaitReply(channel, author.id);
  if (!bodyMsg || !bodyMsg.content.trim()) {
    await channel.send({ embeds: [new EmbedBuilder().setColor(ERR).setDescription('⏱️ انتهى الوقت أو الرسالة فارغة. تم الإلغاء.')] });
    return;
  }
  const body = bodyMsg.content.trim();
  if (body.length > 2000) {
    await channel.send({ embeds: [new EmbedBuilder().setColor(ERR).setDescription(`❌ الرسالة طويلة جداً (${body.length} حرف). الحد الأقصى 2000 حرف. تم الإلغاء.`)] });
    return;
  }

  // 2) target: all members or a specific role
  const targetPrompt = await channel.send({
    embeds: [new EmbedBuilder().setColor(ACCENT).setTitle('🎯 من المستهدف؟').setDescription('اختر من تريد إرسال الرسالة لهم.')],
    components: [
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId('bcast:all').setLabel('كل الأعضاء').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('bcast:role').setLabel('رتبة معينة').setStyle(ButtonStyle.Secondary),
      ),
    ],
  });

  let targetMode: 'all' | 'role';
  try {
    const choice = await targetPrompt.awaitMessageComponent({
      filter: (i) => i.user.id === author.id,
      componentType: ComponentType.Button,
      time: STEP_TIMEOUT_MS,
    });
    targetMode = choice.customId === 'bcast:role' ? 'role' : 'all';
    await choice.update({ components: [] });
  } catch {
    await targetPrompt.edit({ components: [] }).catch(() => null);
    await channel.send({ embeds: [new EmbedBuilder().setColor(ERR).setDescription('⏱️ انتهى الوقت. تم الإلغاء.')] });
    return;
  }

  let roleId: string | null = null;
  if (targetMode === 'role') {
    await channel.send({ embeds: [new EmbedBuilder().setColor(ACCENT).setTitle('🏷️ الرتبة').setDescription('منشن الرتبة المستهدفة أو اكتب آيديها.')] });
    const roleMsg = await awaitReply(channel, author.id);
    const mentioned = roleMsg?.mentions.roles.first();
    const rawId = roleMsg?.content.trim().match(/\d{15,}/)?.[0];
    const resolvedId = mentioned?.id ?? rawId ?? null;
    const role = resolvedId ? guild.roles.cache.get(resolvedId) : null;
    if (!role) {
      await channel.send({ embeds: [new EmbedBuilder().setColor(ERR).setDescription('❌ لم أتعرف على الرتبة. تم الإلغاء.')] });
      return;
    }
    roleId = role.id;
  }

  // 3) exclusions
  await channel.send({
    embeds: [
      new EmbedBuilder()
        .setColor(ACCENT)
        .setTitle('🚫 استثناءات')
        .setDescription('منشن الأشخاص الذين **لا** تريد وصول الرسالة لهم.\nأو اكتب **تخطي** لإرسالها للجميع.'),
    ],
  });
  const exclMsg = await awaitReply(channel, author.id);
  if (!exclMsg) {
    await channel.send({ embeds: [new EmbedBuilder().setColor(ERR).setDescription('⏱️ انتهى الوقت. تم الإلغاء.')] });
    return;
  }
  const excludeIds = new Set<string>(exclMsg.mentions.users.map((u) => u.id));

  // Resolve recipients
  await channel.send({ embeds: [new EmbedBuilder().setColor(ACCENT).setDescription('⏳ يتم تجهيز قائمة المستلمين...')] });
  const allMembers = await guild.members.fetch();
  const recipients = [...allMembers.values()].filter((member) => {
    if (member.user.bot) return false;
    if (excludeIds.has(member.id)) return false;
    if (roleId && !member.roles.cache.has(roleId)) return false;
    return true;
  });

  if (recipients.length === 0) {
    await channel.send({ embeds: [new EmbedBuilder().setColor(WARN).setDescription('⚠️ لا يوجد مستلمون مطابقون. تم الإلغاء.')] });
    return;
  }

  // 4) confirmation
  const preview = body.length > 500 ? `${body.slice(0, 500)}…` : body;
  const targetLabel = roleId ? `رتبة <@&${roleId}>` : 'كل الأعضاء';
  const confirmMsg = await channel.send({
    embeds: [
      new EmbedBuilder()
        .setColor(WARN)
        .setTitle('⚠️ تأكيد الإرسال')
        .setDescription('راجع التفاصيل قبل الإرسال. **لا يمكن التراجع بعد البدء.**')
        .addFields(
          { name: '👥 عدد المستلمين', value: `**${recipients.length}**`, inline: true },
          { name: '🎯 المستهدف', value: targetLabel, inline: true },
          { name: '🚫 مستثنون', value: `**${excludeIds.size}**`, inline: true },
          { name: '📝 معاينة الرسالة', value: `>>> ${preview}` },
        ),
    ],
    components: [
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId('bcast:confirm').setLabel('تأكيد الإرسال').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId('bcast:cancel').setLabel('إلغاء').setStyle(ButtonStyle.Danger),
      ),
    ],
  });

  try {
    const decision = await confirmMsg.awaitMessageComponent({
      filter: (i) => i.user.id === author.id,
      componentType: ComponentType.Button,
      time: STEP_TIMEOUT_MS,
    });
    await decision.update({ components: [] });
    if (decision.customId !== 'bcast:confirm') {
      await channel.send({ embeds: [new EmbedBuilder().setColor(ERR).setDescription('❌ تم إلغاء الإرسال.')] });
      return;
    }
  } catch {
    await confirmMsg.edit({ components: [] }).catch(() => null);
    await channel.send({ embeds: [new EmbedBuilder().setColor(ERR).setDescription('⏱️ انتهى وقت التأكيد. تم الإلغاء.')] });
    return;
  }

  // 5) broadcast with a single live-updating embed
  await runBroadcast(channel, body, recipients);
}

async function runBroadcast(channel: TextChannel, body: string, recipients: GuildMember[]): Promise<void> {
  const total = recipients.length;
  let sent = 0;
  let failed = 0;
  let lastTag: string | null = null;
  const failedTags: string[] = [];

  const progressMsg = await channel.send({
    embeds: [progressEmbed({ done: 0, sent: 0, failed: 0, total, lastTag: null, finished: false })],
  });

  let lastEdit = 0;
  for (const member of recipients) {
    try {
      await member.send(body);
      sent += 1;
      lastTag = member.user.tag;
    } catch {
      failed += 1;
      failedTags.push(member.user.tag);
    }

    const done = sent + failed;
    const now = Date.now();
    if (now - lastEdit >= PROGRESS_EDIT_MS || done === total) {
      await progressMsg.edit({ embeds: [progressEmbed({ done, sent, failed, total, lastTag, finished: false })] }).catch(() => null);
      lastEdit = now;
    }

    if (done < total) await sleep(DM_DELAY_MS);
  }

  await progressMsg.edit({ embeds: [progressEmbed({ done: total, sent, failed, total, lastTag, finished: true })] }).catch(() => null);

  const report = new EmbedBuilder()
    .setColor(failed > 0 ? WARN : OK)
    .setTitle('📊 تقرير البرودكاست')
    .setDescription(`تم إرسال الرسالة إلى **${sent}** من **${total}**.`)
    .addFields({ name: '❌ لم تصل', value: failed === 0 ? 'لا أحد 🎉' : `**${failed}** (خاص مقفل أو حظر البوت)`, inline: true });
  if (failedTags.length > 0) {
    report.addFields({ name: 'أمثلة لم تصلهم', value: failedTags.slice(0, 15).map((t) => `\`${t}\``).join('، ').slice(0, 1024) });
  }
  await channel.send({ embeds: [report] });
}

function isAdmin(member: GuildMember | null): boolean {
  return Boolean(member?.permissions.has(PermissionFlagsBits.Administrator));
}

export async function startRuntime(): Promise<void> {
  const token = process.env.BOT_TOKEN;
  const guildId = process.env.GUILD_ID;
  if (!token) throw new Error('[broadcast-bot] BOT_TOKEN is required.');

  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMembers,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
      GatewayIntentBits.DirectMessages,
    ],
    partials: [Partials.Channel],
  });

  client.once(Events.ClientReady, (c) => {
    console.log(`[broadcast-bot] logged in as ${c.user.tag} (guild ${guildId ?? 'any'})`);
  });

  client.on(Events.MessageCreate, async (message) => {
    if (message.author.bot || !message.guild || !message.member) return;
    if (guildId && message.guild.id !== guildId) return;
    const content = message.content.trim();
    if (content !== COMMAND && content !== COMMAND_ALIAS) return;

    if (!isAdmin(message.member)) {
      await message.reply({ embeds: [new EmbedBuilder().setColor(ERR).setDescription('❌ هذا الأمر للمشرفين فقط (يتطلب صلاحية Administrator).')] }).catch(() => null);
      return;
    }

    const key = `${message.guild.id}:${message.author.id}`;
    if (activeSessions.has(key)) {
      await message.reply({ embeds: [new EmbedBuilder().setColor(WARN).setDescription('⚠️ لديك جلسة برودكاست جارية بالفعل. أكملها أولاً.')] }).catch(() => null);
      return;
    }

    activeSessions.add(key);
    try {
      await runFlow(message);
    } catch (error) {
      console.error('[broadcast-bot] flow error:', error instanceof Error ? error.message : error);
      await (message.channel as TextChannel).send({ embeds: [new EmbedBuilder().setColor(ERR).setDescription('حدث خطأ غير متوقع. حاول مرة أخرى.')] }).catch(() => null);
    } finally {
      activeSessions.delete(key);
    }
  });

  await client.login(token);
}

// Only self-start when the factory spawned this file as its own child process
// (the orchestrator/sold path). The standalone owner entry imports startRuntime
// and calls it in-process, so it must NOT auto-run here.
if (process.env.BROADCAST_SPAWNED === '1') {
  startRuntime().catch((error) => {
    console.error('[broadcast-bot] fatal:', error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
