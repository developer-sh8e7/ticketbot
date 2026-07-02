import { mkdirSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { Client, Events, GatewayIntentBits, Partials, REST, Routes, SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { createLogger, type BotFactory, type BotRuntimeOptions, type RunningBot } from '@opus/core';
import { ConfigStore } from './legacy/services/configStore.js';
import { TempRoomService } from './legacy/services/tempRoomService.js';
import { Voice247Service } from './legacy/services/voice247Service.js';

const log = createLogger('voice-rooms-bot');

// The /setup-room setup command lives on the TempRooms bot only.
// It intentionally has no options: TempRoomService applies the required defaults.
const setupRoomCommand = new SlashCommandBuilder()
  .setName('setup-room')
  .setDescription('إعداد نظام الرومات الصوتية المؤقتة تلقائياً')
  .setDefaultMemberPermissions(String(PermissionFlagsBits.ManageChannels));

/**
 * A fresh guild has no saved config, so options.config is empty and the strict
 * config loader would throw and crash the bot (it then shows offline). Fall
 * back to a bundled, schema-valid default with the target guild id filled in.
 */
function resolveConfig(config: Record<string, unknown> | undefined, guildId: string): Record<string, unknown> {
  if (config && Object.keys(config).length > 0) return config;
  const defaultPath = fileURLToPath(new URL('../assets/default-config.json', import.meta.url));
  const def = JSON.parse(readFileSync(defaultPath, 'utf8')) as Record<string, unknown>;
  if (def.guild && typeof def.guild === 'object') (def.guild as Record<string, unknown>).id = guildId;
  return def;
}

/** Voice/TempRooms Bot factory using the original TempRoomService and Voice247Service logic. */
export const createVoiceRoomsBot: BotFactory = (options: BotRuntimeOptions): RunningBot => {
  const runtimeDir = join(tmpdir(), 'opus-solutions', options.instanceId);
  const configPath = join(runtimeDir, `config_${options.guildId}.json`);
  let client: Client | null = null;
  let configStore: ConfigStore | null = null;
  let tempRooms: TempRoomService | null = null;
  let voice247: Voice247Service | null = null;

  return {
    productType: 'voice_rooms',
    instanceId: options.instanceId,
    async start() {
      mkdirSync(runtimeDir, { recursive: true });
      const config = resolveConfig(options.config as Record<string, unknown> | undefined, options.guildId);
      writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
      configStore = new ConfigStore(configPath);
      tempRooms = new TempRoomService(configStore);
      voice247 = new Voice247Service(configStore);
      client = new Client({
        intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates, GatewayIntentBits.GuildMembers, GatewayIntentBits.GuildMessages],
        partials: [Partials.Channel, Partials.Message],
      });
      client.once(Events.ClientReady, async (ready) => {
        log.info(`Voice rooms bot ready: ${ready.user.tag} → guild ${options.guildId}`);
        // Register the /setup-room command for this guild using the bot's OWN
        // application id (guild-scoped = instant, and avoids the 20012 error).
        try {
          await new REST({ version: '10' }).setToken(options.token).put(
            Routes.applicationGuildCommands(ready.application.id, options.guildId),
            { body: [setupRoomCommand.toJSON()] },
          );
          log.info(`Registered /setup-room for guild ${options.guildId}`);
        } catch (error) {
          log.error(`Failed to register /setup-room: ${String(error)}`);
        }
        await tempRooms?.recoverAll(ready).catch((error) => log.error(String(error)));
        await voice247?.recoverAll(ready).catch((error) => log.error(String(error)));
      });
      client.on(Events.VoiceStateUpdate, async (oldState, newState) => {
        if (oldState.guild.id !== options.guildId && newState.guild.id !== options.guildId) return;
        await tempRooms?.handleVoiceStateUpdate(oldState, newState).catch((error) => log.error(String(error)));
        await voice247?.handleVoiceStateUpdate(oldState, newState).catch((error) => log.error(String(error)));
      });
      client.on(Events.InteractionCreate, async (interaction) => {
        if (interaction.guildId !== options.guildId) return;
        if (!interaction.isButton() && !interaction.isStringSelectMenu() && !interaction.isUserSelectMenu() && !interaction.isModalSubmit() && !interaction.isChatInputCommand()) return;
        const id = 'customId' in interaction ? interaction.customId : interaction.commandName;
        if (interaction.isChatInputCommand() && id === 'setup-room') {
          await tempRooms?.handleSetupCommand(interaction).catch((error) => log.error(String(error)));
        } else if (interaction.isButton() && tempRooms?.isTempButton(id)) {
          await tempRooms.handleButton(interaction).catch((error) => log.error(String(error)));
        } else if ((interaction.isStringSelectMenu() || interaction.isUserSelectMenu()) && tempRooms?.isTempSelect(id)) {
          await tempRooms.handleSelect(interaction).catch((error) => log.error(String(error)));
        } else if (interaction.isModalSubmit() && tempRooms?.isTempModal(id)) {
          await tempRooms.handleModal(interaction).catch((error) => log.error(String(error)));
        }
      });
      await client.login(options.token);
      return { botUserId: client.user?.id ?? '' };
    },
    async stop() {
      await client?.destroy();
      client = null;
      rmSync(runtimeDir, { recursive: true, force: true });
    },
  };
};

export default createVoiceRoomsBot;
