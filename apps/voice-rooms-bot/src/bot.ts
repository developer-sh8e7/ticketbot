import { Client, Events, GatewayIntentBits } from 'discord.js';
import {
  createLogger,
  createSupabaseClient,
  type BotFactory,
  type BotRuntimeOptions,
  type RunningBot,
} from '@opus/core';

const log = createLogger('voice-rooms-bot');

/**
 * مصنع بوت الغرف الصوتية المؤقتة.
 *
 * ── الخدمات التي تُرحّل إلى هذه الحزمة (انظر MIGRATION_MAP.md) ──
 *   services: tempRoomService, voice247Service
 *
 * الفكرة: عضو يدخل قناة "إنشاء" → ينشئ البوت قناة صوتية مؤقتة يملكها،
 * تُحذف عند فراغها، مع نقل الملكية عند مغادرة المالك.
 */
export const createVoiceRoomsBot: BotFactory = (options: BotRuntimeOptions): RunningBot => {
  const supabase = createSupabaseClient({
    SUPABASE_URL: options.supabaseUrl,
    SUPABASE_SERVICE_ROLE_KEY: options.supabaseServiceRoleKey,
  });

  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildVoiceStates,
      GatewayIntentBits.GuildMembers,
    ],
  });

  client.once(Events.ClientReady, async (ready) => {
    log.info(`🔊 Voice rooms bot ready: ${ready.user.tag} → guild ${options.guildId}`);
    // TODO(migration): استعادة لوحة التحكم وقنوات الإنشاء من options.config.
    void supabase;
  });

  client.on(Events.VoiceStateUpdate, async (oldState, newState) => {
    if (newState.guild.id !== options.guildId && oldState.guild.id !== options.guildId) return;
    // TODO(migration): TempRoomService.handleVoiceStateUpdate(oldState, newState)
  });

  client.on(Events.Error, (err) => log.error(`Voice client error: ${err.message}`));

  return {
    productType: 'voice_rooms',
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

export default createVoiceRoomsBot;
