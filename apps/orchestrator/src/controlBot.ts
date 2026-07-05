import {
  Client,
  GatewayIntentBits,
  Events,
  REST,
  Routes,
  SlashCommandBuilder,
  EmbedBuilder,
  MessageFlags,
  type ChatInputCommandInteraction,
} from 'discord.js';
import { createLogger, type SupabaseClient } from '@opus/core';
import type { OrchestratorEnv } from './env.js';

const log = createLogger('control-bot');

const PRODUCT_LABELS: Record<string, string> = {
  ticket: 'التذاكر',
  voice_rooms: 'الغرف المؤقتة',
  general: 'الإدارة',
  broadcast: 'البرودكاست',
};

function fmt(value: string | null | undefined): string {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? String(value) : `<t:${Math.floor(d.getTime() / 1000)}:f>`;
}

/**
 * Owner-only control bot for the orchestrator.
 *
 * Hosts a single guild-scoped `/info` command that looks up everything we know
 * about a Discord user. It is locked down three ways:
 *   1. The command is registered ONLY in CONTROL_GUILD_ID (not global).
 *   2. The interaction handler rejects any guild other than CONTROL_GUILD_ID.
 *   3. The interaction handler rejects any user other than OWNER_DISCORD_ID.
 * Unauthorized callers get an ephemeral refusal with no data leaked.
 *
 * No-op (and safe) when OPUS_CONTROL_BOT_TOKEN is not configured.
 */
export async function startControlBot(supabase: SupabaseClient, env: OrchestratorEnv): Promise<Client | null> {
  const token = env.OPUS_CONTROL_BOT_TOKEN;
  if (!token) {
    log.info('OPUS_CONTROL_BOT_TOKEN غير مهيأ — تخطّي بوت التحكم (/info).');
    return null;
  }

  const client = new Client({ intents: [GatewayIntentBits.Guilds] });

  client.once(Events.ClientReady, async (ready) => {
    log.info(`🛡️ بوت التحكم جاهز كـ ${ready.user.tag}`);
    try {
      const command = new SlashCommandBuilder()
        .setName('info')
        .setDescription('عرض كل معلومات مستخدم (للمالك فقط)')
        .addStringOption((opt) =>
          opt.setName('discord_id').setDescription('Discord ID للمستخدم المطلوب').setRequired(true),
        )
        .toJSON();

      const rest = new REST({ version: '10' }).setToken(token);
      await rest.put(Routes.applicationGuildCommands(ready.user.id, env.CONTROL_GUILD_ID), { body: [command] });
      log.info(`سجّلت /info في السيرفر ${env.CONTROL_GUILD_ID}`);
    } catch (e) {
      log.error('فشل تسجيل أمر /info', e instanceof Error ? e.message : e);
    }
  });

  client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isChatInputCommand() || interaction.commandName !== 'info') return;

    // Triple gate: correct guild AND owner only. Refuse everything else silently.
    if (interaction.guildId !== env.CONTROL_GUILD_ID || interaction.user.id !== env.OWNER_DISCORD_ID) {
      await interaction.reply({ content: '⛔ هذا الأمر مقصور على مالك المتجر.', flags: MessageFlags.Ephemeral }).catch(() => {});
      return;
    }

    await handleInfo(interaction, supabase);
  });

  client.on(Events.Error, (e) => log.error('control bot error', e instanceof Error ? e.message : e));

  await client.login(token);
  return client;
}

async function handleInfo(interaction: ChatInputCommandInteraction, supabase: SupabaseClient): Promise<void> {
  const targetId = interaction.options.getString('discord_id', true).trim();

  if (!/^\d{17,20}$/.test(targetId)) {
    await interaction.reply({ content: '⚠️ معرّف Discord غير صالح.', flags: MessageFlags.Ephemeral }).catch(() => {});
    return;
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  try {
    const [account, session, bots, subs] = await Promise.all([
      supabase.from('accounts').select('discord_username,email,avatar_url,created_at,last_login_at').eq('discord_user_id', targetId).maybeSingle(),
      supabase.from('customer_sessions').select('ip_address,user_agent,created_at').eq('discord_user_id', targetId).order('created_at', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('bot_instances').select('product_type,status,plan_type,guild_id,expires_at,created_at').eq('owner_id', targetId).order('created_at', { ascending: false }).limit(15),
      supabase.from('subscriptions').select('product_type,status,plan_name,expires_at').eq('owner_id', targetId).order('created_at', { ascending: false }).limit(15),
    ]);

    const acc = account.data;
    const sess = session.data;
    const botRows = bots.data || [];
    const subRows = subs.data || [];

    if (!acc && botRows.length === 0 && subRows.length === 0) {
      await interaction.editReply({ content: `لا توجد بيانات للمستخدم \`${targetId}\`.` });
      return;
    }

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle('🔎 معلومات المستخدم')
      .setDescription(`<@${targetId}> • \`${targetId}\``)
      .setTimestamp();

    if (acc?.avatar_url) {
      embed.setThumbnail(`https://cdn.discordapp.com/avatars/${targetId}/${acc.avatar_url}.png?size=128`);
    }

    embed.addFields(
      { name: '👤 الاسم', value: acc?.discord_username || '—', inline: true },
      { name: '📧 الإيميل', value: acc?.email || '—', inline: true },
      { name: '🗓️ تاريخ التسجيل', value: fmt(acc?.created_at), inline: true },
      { name: '🕐 آخر دخول', value: fmt(acc?.last_login_at ?? sess?.created_at), inline: true },
      { name: '🌐 آخر IP', value: sess?.ip_address ? `\`${sess.ip_address}\`` : '—', inline: true },
      { name: '💻 آخر جهاز', value: sess?.user_agent ? `\`${String(sess.user_agent).slice(0, 60)}\`` : '—', inline: true },
    );

    const botsText = botRows.length
      ? botRows
          .map((b) => `• **${PRODUCT_LABELS[b.product_type] ?? b.product_type}** — ${b.status} (${b.plan_type}) | سيرفر \`${b.guild_id}\` | ينتهي ${fmt(b.expires_at)}`)
          .join('\n')
          .slice(0, 1024)
      : 'لا توجد بوتات.';
    embed.addFields({ name: `🤖 البوتات (${botRows.length})`, value: botsText, inline: false });

    if (subRows.length) {
      const subsText = subRows
        .map((s) => `• ${PRODUCT_LABELS[s.product_type] ?? s.product_type} — ${s.status} (${s.plan_name}) | ينتهي ${fmt(s.expires_at)}`)
        .join('\n')
        .slice(0, 1024);
      embed.addFields({ name: `📦 الاشتراكات (${subRows.length})`, value: subsText, inline: false });
    }

    await interaction.editReply({ embeds: [embed] });
  } catch (e) {
    log.error('فشل تنفيذ /info', e instanceof Error ? e.message : e);
    await interaction.editReply({ content: '❌ تعذّر جلب البيانات. حاول لاحقاً.' }).catch(() => {});
  }
}
