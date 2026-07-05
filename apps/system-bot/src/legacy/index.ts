// ══════════════════════════════════════════════════════════════
//  Opus System Bot — Entry Point (V2)
// ══════════════════════════════════════════════════════════════

import { Client, GatewayIntentBits, Partials, Collection, REST, Routes, type Guild } from "discord.js";
import { Config } from "./config.js";
import { Logger } from "./utils/logger.js";
import { Command } from "./types.js";

// Import all commands manually (avoids fs/path issues in some compiled environments)
import banCommand from "./commands/moderation/ban.js";
import softbanCommand from "./commands/moderation/softban.js";
import kickCommand from "./commands/moderation/kick.js";
import timeoutCommand from "./commands/moderation/timeout.js";
import muteCommand from "./commands/moderation/mute.js";
import unmuteCommand from "./commands/moderation/unmute.js";
import warnCommand from "./commands/moderation/warn.js";
import warningsCommand from "./commands/moderation/warnings.js";
import clearwarnsCommand from "./commands/moderation/clearwarns.js";
import clearCommand from "./commands/moderation/clear.js";
import unbanCommand from "./commands/moderation/unban.js";
import slowmodeCommand from "./commands/moderation/slowmode.js";
import { lockCommand, unlockCommand } from "./commands/moderation/lock.js";
import nukeCommand from "./commands/moderation/nuke.js";

import serverinfoCommand from "./commands/info/serverinfo.js";
import userinfoCommand from "./commands/info/userinfo.js";
import avatarCommand from "./commands/info/avatar.js";
import pingCommand from "./commands/info/ping.js";
import helpCommand from "./commands/info/help.js";
import profileCommand from "./commands/info/profile.js";

import roleCommand from "./commands/moderation/role.js";
import nickCommand from "./commands/moderation/nick.js";
import hideCommand from "./commands/moderation/hide.js";
import showCommand from "./commands/moderation/show.js";

import {
  setWelcomeCommand,
  setLeaveCommand,
  setLogsCommand,
  autoRoleCommand,
  embedCommand,
  antiRaidCommand,
} from "./commands/settings/settings.js";

import {
  protectionCommand,
  antiLinksCommand,
  antiSpamCommand,
  antiBotsCommand,
  antiSwearCommand,
} from "./commands/settings/protection.js";

import creditsCommand from "./commands/economy/credits.js";
import dailyCommand from "./commands/economy/daily.js";
import repCommand from "./commands/economy/rep.js";

import rankCommand from "./commands/levels/rank.js";
import topCommand from "./commands/levels/top.js";

import rollCommand from "./commands/fun/roll.js";
import coinflipCommand from "./commands/fun/coinflip.js";

// Import Events
import readyEvent from "./events/ready.js";
import messageCreateEvent from "./events/messageCreate.js";
import interactionCreateEvent from "./events/interactionCreate.js";
import guildMemberAddEvent from "./events/guildMemberAdd.js";
import guildMemberRemoveEvent from "./events/guildMemberRemove.js";
import { messageDeleteEvent, messageUpdateEvent } from "./events/messageLogs.js";
import voiceStateUpdateEvent from "./events/voiceStateUpdate.js";

const allCommands = [
  banCommand,
  softbanCommand,
  kickCommand,
  timeoutCommand,
  muteCommand,
  unmuteCommand,
  warnCommand,
  warningsCommand,
  clearwarnsCommand,
  clearCommand,
  unbanCommand,
  slowmodeCommand,
  lockCommand,
  unlockCommand,
  nukeCommand,
  serverinfoCommand,
  userinfoCommand,
  avatarCommand,
  pingCommand,
  helpCommand,

  setWelcomeCommand,
  setLeaveCommand,
  setLogsCommand,
  autoRoleCommand,
  embedCommand,
  antiRaidCommand,
  protectionCommand, // NEW Unified Command

  roleCommand,
  nickCommand,
  hideCommand,
  showCommand,

  creditsCommand,
  dailyCommand,
  repCommand,

  rankCommand,
  topCommand,

  profileCommand,
  rollCommand,
  coinflipCommand,
];

const allEvents = [
  readyEvent,
  messageCreateEvent,
  interactionCreateEvent,
  guildMemberAddEvent,
  guildMemberRemoveEvent,
  messageDeleteEvent,
  messageUpdateEvent,
  voiceStateUpdateEvent,
];

// Initialize Discord Client with all required intents
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildPresences,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessageReactions,
  ],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction, Partials.User, Partials.GuildMember],
});

// Create command collection and attach to client
(client as any).commands = new Collection<string, Command>();

// Register Commands
for (const cmd of allCommands) {
  (client as any).commands.set(cmd.data.name, cmd);
}

// Register Events
for (const event of allEvents) {
  if (event.once) {
    // @ts-ignore
    client.once(event.name, (...args: any[]) => event.execute(client as any, ...args));
  } else {
    // @ts-ignore
    client.on(event.name, (...args: any[]) => event.execute(client as any, ...args));
  }
}

// Global unhandled rejection handler to prevent bot crashes
process.on("unhandledRejection", (error) => {
  Logger.error(`Unhandled Rejection: ${error}`);
});

// Register this instance's slash commands with Discord for its own guild.
// Each deployed bot is a separate Discord application (its own client id), so
// commands must be (re)registered per instance — the old deploy-commands.ts
// script was a manual, one-off dev tool and was never invoked for tenant
// bots spawned by the orchestrator, which is why new servers had no commands.
// client.application.id is always correct for THIS bot, no env var needed.
function inviteUrl(): string | null {
  const applicationId = client.application?.id ?? Config.clientId;
  if (!applicationId) return null;

  const params = new URLSearchParams({
    client_id: applicationId,
    permissions: "8",
    scope: "bot applications.commands",
  });
  if (Config.guildId) params.set("guild_id", Config.guildId);

  return `https://discord.com/api/oauth2/authorize?${params.toString()}`;
}

async function getTargetGuild(): Promise<Guild | null> {
  if (!Config.guildId) return null;

  const cached = client.guilds.cache.get(Config.guildId);
  if (cached) return cached;

  try {
    return await client.guilds.fetch(Config.guildId);
  } catch {
    Logger.warn(`Guild ${Config.guildId} is not accessible by this bot; skipping guild slash-command deploy.`);
    const url = inviteUrl();
    if (url) Logger.warn(`Invite/re-authorize the bot with this URL, then restart: ${url}`);
    return null;
  }
}

async function deployGuildCommands() {
  if (!client.application || !Config.guildId) return;

  const guild = await getTargetGuild();
  if (!guild) return;

  const commandData = allCommands.map((c) => c.data.toJSON());
  try {
    await new REST({ version: "10" }).setToken(Config.token).put(
      Routes.applicationGuildCommands(client.application.id, guild.id),
      { body: commandData },
    );
    Logger.success(`Deployed ${commandData.length} slash commands to guild ${guild.id}`);
  } catch (err) {
    Logger.error(`Failed to auto-deploy slash commands: ${err}`);
    const url = inviteUrl();
    if (url) Logger.warn(`If Discord reports Missing Access, re-authorize the bot with: ${url}`);
  }
}

// Start the bot
client.login(Config.token)
  .then(deployGuildCommands)
  .catch((err) => {
    Logger.error(`Failed to login: ${err}`);
  });
