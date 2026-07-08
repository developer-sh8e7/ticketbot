import { spawn, type ChildProcess } from 'node:child_process';
import { mkdirSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { createLogger, type BotFactory, type BotRuntimeOptions, type RunningBot } from '@opus/core';

const log = createLogger('ticket-bot');

// The legacy ticket worker starts its own Express health server on process.env.PORT.
// In production Railway sets PORT=8080 — the same port the orchestrator binds — so
// the inherited value made the worker grab 8080 and crash the orchestrator with
// EADDRINUSE (restart loop). Give each ticket worker its own unique internal port.
let nextHealthPort = 3101;

const STB_GUILD_ID = '1413059459630104626';
const STORE_GUILD_ID = '1395842846107631746';
const SEED_GUILD_IDS = new Set([STB_GUILD_ID, STORE_GUILD_ID]);
const DEFAULT_CUSTOMER_PANEL_BANNER_URL = 'https://i.imgur.com/4pv05GF.png';
const DEFAULT_CUSTOMER_TICKET_BANNER_URL = 'https://i.imgur.com/fc30QyW.png';

function cloneConfig(config: Record<string, unknown>): Record<string, unknown> {
  return JSON.parse(JSON.stringify(config)) as Record<string, unknown>;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function applyCustomerDefaults(config: Record<string, unknown>): void {
  const images = asRecord(config.images) ?? {};
  images.panelBannerUrl = DEFAULT_CUSTOMER_PANEL_BANNER_URL;
  images.ticketBannerUrl = DEFAULT_CUSTOMER_TICKET_BANNER_URL;
  images.thumbnailUrl = typeof images.thumbnailUrl === 'string' ? images.thumbnailUrl : '';
  config.images = images;

  const panel = asRecord(config.panel) ?? {};
  panel.menuPlaceholder = 'اختر نوع التذكرة...';
  panel.defaultMention = '';
  config.panel = panel;

  const emojis = asRecord(config.emojis) ?? {};
  emojis.categories = {};
  config.emojis = emojis;

  config.categories = [{
    key: 'support',
    enabled: true,
    label: 'الدعم الفني',
    description: 'للتواصل مع الدعم الفني.',
    channelNameTemplate: 'دعم-{ticketNumber}',
    supportRoleIds: [],
    questions: [],
  }];

  const features = asRecord(config.features) ?? {};
  features.applicationsPanel = false;
  features.tempRoomsPanel = false;
  config.features = features;

  const tempRooms = asRecord(config.tempRooms);
  if (tempRooms) tempRooms.enabled = false;
  const voice247 = asRecord(config.voice247);
  if (voice247) voice247.enabled = false;
  const mediatorWarnings = asRecord(config.mediatorWarnings);
  if (mediatorWarnings) mediatorWarnings.enabled = false;
}

function applyDashboardTicketSettings(config: Record<string, unknown>): void {
  const settings = asRecord(config.ticketSettings);
  if (!settings) return;

  const guild = asRecord(config.guild) ?? {};
  if (typeof settings.panel_channel_id === 'string' && settings.panel_channel_id.trim()) {
    const panel = asRecord(config.panel) ?? {};
    panel.channelId = settings.panel_channel_id.trim();
    config.panel = panel;
  }
  if (typeof settings.transcript_channel_id === 'string' && settings.transcript_channel_id.trim()) guild.transcriptChannelId = settings.transcript_channel_id.trim();
  if (typeof settings.ticket_category_id === 'string' && settings.ticket_category_id.trim()) guild.categoryId = settings.ticket_category_id.trim();
  if (typeof settings.archive_category_id === 'string' && settings.archive_category_id.trim()) guild.archiveCategoryId = settings.archive_category_id.trim();
  if (typeof settings.support_role_id === 'string' && settings.support_role_id.trim()) guild.supportRoleIds = [settings.support_role_id.trim()];
  config.guild = guild;

  const images = asRecord(config.images) ?? {};
  if (typeof settings.banner_url === 'string' && settings.banner_url.trim()) images.panelBannerUrl = settings.banner_url.trim();
  if (typeof settings.ticket_banner_url === 'string' && settings.ticket_banner_url.trim()) images.ticketBannerUrl = settings.ticket_banner_url.trim();
  config.images = images;

  const panel = asRecord(config.panel) ?? {};
  if (typeof settings.panel_message === 'string') panel.description = settings.panel_message;
  if (typeof settings.button_text === 'string' && settings.button_text.trim()) panel.menuPlaceholder = settings.button_text;
  config.panel = panel;

  const bot = asRecord(config.bot) ?? {};
  if (typeof settings.embed_color === 'string' && settings.embed_color.trim()) bot.embedColor = settings.embed_color;
  if (typeof settings.footer_text === 'string') bot.footerText = settings.footer_text;
  config.bot = bot;

  const categories = Array.isArray(settings.categories) ? settings.categories : [];
  if (categories.length > 0) {
    config.categories = categories
      .filter((item): item is Record<string, unknown> => Boolean(asRecord(item)))
      .map((item) => ({
        key: String(item.key || 'support'),
        enabled: item.enabled !== false,
        label: String(item.label || 'الدعم الفني'),
        description: String(item.description || 'للتواصل مع الدعم الفني.'),
        channelNameTemplate: 'دعم-{ticketNumber}',
        supportRoleIds: [],
        questions: [],
      }));

    const emojis = asRecord(config.emojis) ?? {};
    const categoryEmojis: Record<string, string> = {};
    for (const item of categories) {
      const record = asRecord(item);
      if (!record) continue;
      const key = String(record.key || '');
      const emoji = typeof record.emoji === 'string' ? record.emoji : '';
      if (key && emoji) categoryEmojis[key] = emoji;
    }
    emojis.categories = categoryEmojis;
    config.emojis = emojis;
  }

  const buttons = asRecord(settings.buttons);
  const ticket = asRecord(config.ticket);
  const controls = asRecord(ticket?.controls);
  if (ticket && controls && buttons) {
    for (const key of ['close', 'add', 'remove', 'claim', 'pin']) {
      const source = asRecord(buttons[key]);
      const target = asRecord(controls[key]);
      if (!source || !target) continue;
      if (typeof source.label === 'string' && source.label.trim()) target.label = source.label;
      if (typeof source.style === 'string' && source.style.trim()) target.style = source.style;
      if (typeof source.emoji === 'string') target.emojiId = source.emoji;
    }
  }
}

function prepareRuntimeConfig(config: Record<string, unknown>, guildId: string): Record<string, unknown> {
  const prepared = cloneConfig(config);
  if (prepared.guild && typeof prepared.guild === 'object') {
    (prepared.guild as Record<string, unknown>).id = guildId;
  }

  if (!SEED_GUILD_IDS.has(guildId)) {
    applyCustomerDefaults(prepared);
  }

  applyDashboardTicketSettings(prepared);

  if (guildId !== STB_GUILD_ID) {
    if (prepared.roleProtection && typeof prepared.roleProtection === 'object') {
      (prepared.roleProtection as Record<string, unknown>).enabled = false;
    }
    if (prepared.roleManagement && typeof prepared.roleManagement === 'object') {
      (prepared.roleManagement as Record<string, unknown>).enabled = false;
    }
  }

  return prepared;
}

/**
 * A fresh guild has no saved server_configs row, so options.config is empty and
 * the legacy loader's strict schema would reject it and crash the worker (the
 * bot then shows offline). Fall back to a bundled, schema-valid default config
 * with the target guild id filled in.
 */
function resolveConfig(config: Record<string, unknown> | undefined, guildId: string): Record<string, unknown> {
  if (config && Object.keys(config).length > 0) return prepareRuntimeConfig(config, guildId);
  const defaultPath = fileURLToPath(new URL('../assets/default-config.json', import.meta.url));
  const def = JSON.parse(readFileSync(defaultPath, 'utf8')) as Record<string, unknown>;
  return prepareRuntimeConfig(def, guildId);
}

function legacyEntry(): string {
  return process.env.NODE_ENV === 'production' || import.meta.url.includes('/dist/')
    ? new URL('./legacy/index.js', import.meta.url).pathname
    : new URL('./legacy/index.ts', import.meta.url).pathname;
}

function commandFor(entry: string): { cmd: string; args: string[] } {
  return entry.endsWith('.ts') ? { cmd: 'npx', args: ['tsx', entry] } : { cmd: process.execPath, args: [entry] };
}

/**
 * Ticket Bot factory.
 *
 * The complete legacy Ticket runtime from C:/Users/pkg/Downloads/Ticket/src is kept under
 * src/legacy and executed as an isolated per-instance worker. This preserves the original
 * ticket, mediator, escalation, transcript, panel, role-protection, vouches, welcome,
 * temp-room and config logic while the SaaS orchestrator owns subscription/token lifecycle.
 */
export const createTicketBot: BotFactory = (options: BotRuntimeOptions): RunningBot => {
  let child: ChildProcess | null = null;
  const runtimeDir = join(tmpdir(), 'opus-solutions', options.instanceId);
  const configPath = join(runtimeDir, `config_${options.guildId}.json`);

  return {
    productType: 'ticket',
    instanceId: options.instanceId,
    async start() {
      mkdirSync(runtimeDir, { recursive: true });
      const config = resolveConfig(options.config as Record<string, unknown> | undefined, options.guildId);
      writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
      const entry = legacyEntry();
      const { cmd, args } = commandFor(entry);
      child = spawn(cmd, args, {
        cwd: new URL('..', import.meta.url).pathname,
        env: {
          ...process.env,
          RUN_MODE: 'legacy',
          DISCORD_TOKEN: options.token,
          SUPABASE_URL: options.supabaseUrl,
          SUPABASE_SERVICE_ROLE_KEY: options.supabaseServiceRoleKey,
          CONFIG_PATH: configPath,
          // Unique internal health port — must not collide with the orchestrator's 8080.
          PORT: String(nextHealthPort++),
        },
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      child.stdout?.on('data', (chunk) => log.info(String(chunk).replace(options.token, '[redacted]').trim()));
      child.stderr?.on('data', (chunk) => log.error(String(chunk).replace(options.token, '[redacted]').trim()));
      child.on('exit', (code, signal) => log.warn(`Ticket worker ${options.instanceId} exited code=${code} signal=${signal}`));
      return { botUserId: '' };
    },
    async stop() {
      if (child && !child.killed) child.kill('SIGTERM');
      child = null;
      rmSync(runtimeDir, { recursive: true, force: true });
    },
  };
};

export default createTicketBot;
