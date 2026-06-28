import { Client, Events, GatewayIntentBits, Partials } from 'discord.js';
import {
  createLogger,
  createSupabaseClient,
  type BotFactory,
  type BotRuntimeOptions,
  type RunningBot,
} from '@opus/core';

const log = createLogger('general-bot');

/**
 * مصنع البوت العام (الإدارة + المستويات + الاقتصاد + الألعاب).
 *
 * ── مصادر الترحيل (انظر MIGRATION_MAP.md) ──
 *   - حزمة discord-bot/ القديمة (40 أمر: economy, games, anti-nuke, mod, levels, settings)
 *   - حزمة "SystemBot Opus"/ (31 أمر — نسخة متباعدة؛ تُدمج المميزات المختلفة بانتقائية)
 *   - حزمة BotGames/ (8 ألعاب تفاعلية)
 *   - src/data/ (gameKnowledgeBase, gameAdvancedMechanics, gameUnifiedIndex)
 *
 * ملاحظة: discord-bot و "SystemBot Opus" متباعدتان (فجوة 9 أوامر)؛
 *         تُوحَّد الأوامر هنا في طبقة أوامر واحدة بدل بوتين متوازيين.
 */
export const createGeneralBot: BotFactory = (options: BotRuntimeOptions): RunningBot => {
  const supabase = createSupabaseClient({
    SUPABASE_URL: options.supabaseUrl,
    SUPABASE_SERVICE_ROLE_KEY: options.supabaseServiceRoleKey,
  });

  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.GuildMembers,
      GatewayIntentBits.MessageContent,
      GatewayIntentBits.GuildModeration,
    ],
    partials: [Partials.Channel, Partials.Message, Partials.GuildMember],
  });

  client.once(Events.ClientReady, async (ready) => {
    log.info(`⚙️ General bot ready: ${ready.user.tag} → guild ${options.guildId}`);
    // TODO(migration): تحميل وحدات الأوامر (mod/levels/economy/games) واستعادة الإعدادات من options.config.
    void supabase;
  });

  client.on(Events.InteractionCreate, async (interaction) => {
    if (interaction.guildId !== options.guildId) return;
    // TODO(migration): توجيه الأوامر إلى مسجّل أوامر البوت العام الموحّد.
  });

  client.on(Events.Error, (err) => log.error(`General client error: ${err.message}`));

  return {
    productType: 'general',
    instanceId: options.instanceId,
    async start() {
      await client.login(options.token);
      return { botUserId: client.user?.id ?? '' };
    },
    async stop() {
      await client.destroy();
    },
  };
};

export default createGeneralBot;
