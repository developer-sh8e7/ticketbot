/** تشغيل مستقل لبوت الغرف المؤقتة (تطوير + Railway). */
import { createClient } from '@supabase/supabase-js';
import { createVoiceRoomsBot } from './bot.js';

/** Default config satisfying the schema for a brand-new voice-rooms subscriber.
 *  Ticket/role fields are scaffolded with placeholder values — only tempRooms
 *  and voice247 sections are actually used by this bot at runtime. */
function buildDefaultConfig(guildId: string): Record<string, unknown> {
  return {
    bot: {
      presence: { status: 'online', activityType: 'Listening', activityName: 'Voice Rooms' },
      locale: 'ar',
      timezone: 'Asia/Riyadh',
      embedColor: '#5865F2',
      errorColor: '#ef4444',
      successColor: '#22c55e',
      footerText: '',
      footerIconUrl: '',
    },
    guild: {
      id: guildId,
      categoryId: '',
      archiveCategoryId: '',
      logChannelId: '',
      transcriptChannelId: '',
      supportRoleIds: [],
      managerRoleIds: [],
      mentionRolesOnOpen: [],
    },
    images: { panelBannerUrl: '', ticketBannerUrl: '', thumbnailUrl: '' },
    naming: {
      ticketChannelPrefix: 'ticket',
      maxChannelNameLength: 90,
      includeCategorySlug: false,
      zeroPadLength: 4,
      topicTemplate: 'Ticket #{ticketNumber}',
    },
    limits: {
      allowOnlyOneOpenTicketPerUser: true,
      maxQuestionsPerCategory: 5,
      maxAnswerLength: 400,
      maxCategoryOptions: 25,
      pinSummaryMessageOnCreate: false,
    },
    panel: {
      channelId: '',
      messageId: '',
      title: '',
      subtitle: '',
      description: '',
      menuPlaceholder: 'Select...',
      menuCustomId: 'rooms:menu',
      defaultMention: '',
      showNumbers: false,
      accentText: '',
    },
    ticket: {
      welcomeTitle: 'Ticket Opened',
      welcomeDescription: 'A support member will be with you shortly.',
      summaryTitle: 'Ticket Info',
      controls: {
        close:  { label: 'Close',  style: 'Secondary', emojiId: '' },
        add:    { label: 'Add',    style: 'Secondary', emojiId: '' },
        remove: { label: 'Remove', style: 'Secondary', emojiId: '' },
        claim:  { label: 'Claim',  style: 'Secondary', emojiId: '' },
        pin:    { label: 'Pin',    style: 'Secondary', emojiId: '' },
        stats:  { label: 'Stats',  style: 'Secondary', emojiId: '', allowedRoleIds: [] },
      },
      messages: {
        alreadyOpen:   'You already have an open ticket.',
        created:       'Ticket created.',
        closed:        'Ticket closed.',
        claimed:       'Ticket claimed by',
        unclaimed:     'Ticket unclaimed.',
        addedMember:   'Member added.',
        removedMember: 'Member removed.',
        noPermission:  'You do not have permission.',
        notInTicket:   'This button only works inside ticket channels.',
      },
    },
    emojis: { panelIcon: '', ticketIcon: '', infoIcon: '', epicIcon: '', categories: {} },
    categories: [
      {
        key: 'general',
        enabled: true,
        label: 'General',
        description: 'General support',
        channelNameTemplate: 'ticket-{ticketNumber}',
        supportRoleIds: [],
        questions: [],
      },
    ],
    commands: {
      registerOnStartup: true,
      guildScoped: true,
      names: {
        panelSend:    'rooms-panel-send',
        panelRefresh: 'rooms-panel-refresh',
        configReload: 'rooms-config-reload',
        emojiRefresh: 'rooms-emoji-refresh',
        ticketClose:  'rooms-ticket-close',
        ticketStats:  'rooms-ticket-stats',
      },
    },
    roleProtection: {
      enabled: false,
      protectedRoleId:   '0',
      protectedRoleName: 'placeholder',
      excludedRoleId:    '0',
      syncIntervalMinutes: 60,
    },
    roleManagement: {
      enabled: false,
      ownerId: '0',
      allowedRoleIds: ['0'],
      blockedRoleIds: [],
      dailyLimitedRoleId:    '0',
      dailyLimitedRoleLimit: 5,
    },
    features: { applicationsPanel: false, tempRoomsPanel: true },
    tempRooms: {
      enabled: false,
      categoryId: '',
      joinChannelId: '',
      controlChannelId: '',
      controlMessageId: '',
      defaultRoomName: 'روم {username}',
      defaultUserLimit: 0,
      transferOwnershipOnOwnerLeave: true,
      deleteWhenEmpty: true,
      adminBypass: false,
      maxRooms: 50,
      panelImageUrl: 'https://i.imgur.com/BiQetZY.png',
      rooms: {},
    },
    voice247: { enabled: false, channelId: '' },
  };
}

async function main() {
  const token = process.env.DISCORD_TOKEN ?? process.env.ROOMS_DEV_TOKEN;
  const guildId = process.env.GUILD_ID ?? process.env.ROOMS_DEV_GUILD;
  const supabaseUrl = process.env.SUPABASE_URL ?? '';
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

  if (!token || !guildId) {
    throw new Error('DISCORD_TOKEN and GUILD_ID are required (or ROOMS_DEV_TOKEN / ROOMS_DEV_GUILD for local dev).');
  }
  if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.');
  }

  const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

  const { data, error } = await supabase
    .from('server_configs')
    .select('config_data')
    .eq('guild_id', guildId)
    .eq('product_type', 'voice_rooms')
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load config from server_configs: ${error.message}`);
  }

  let config: Record<string, unknown>;

  if (data?.config_data) {
    config = data.config_data as Record<string, unknown>;
    console.log(`[voice-rooms-bot] Loaded config from server_configs for guild ${guildId}`);
  } else {
    console.log(`[voice-rooms-bot] No config found for guild ${guildId} — creating default and saving to server_configs`);
    config = buildDefaultConfig(guildId);

    const { error: upsertError } = await supabase
      .from('server_configs')
      .upsert(
        { guild_id: guildId, product_type: 'voice_rooms', config_data: config },
        { onConflict: 'guild_id,product_type' },
      );

    if (upsertError) {
      console.warn(`[voice-rooms-bot] Could not save default config: ${upsertError.message} — continuing anyway`);
    }
  }

  const bot = createVoiceRoomsBot({
    token,
    guildId,
    ownerId: process.env.OWNER_ID ?? 'standalone',
    instanceId: `standalone-${guildId}`,
    config,
    supabaseUrl,
    supabaseServiceRoleKey,
  });

  const { botUserId } = await bot.start();
  console.log(`[voice-rooms-bot] standalone — guild=${guildId} bot=${botUserId}`);

  process.on('SIGINT', () => bot.stop().then(() => process.exit(0)));
  process.on('SIGTERM', () => bot.stop().then(() => process.exit(0)));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
