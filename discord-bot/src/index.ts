// ══════════════════════════════════════════════════════════════
//  Opus System Bot — Entry Point (V2)
// ══════════════════════════════════════════════════════════════

import { Client, GatewayIntentBits, Partials, Collection, REST, Routes } from "discord.js";
import { Config } from "./config";
import { Logger } from "./utils/logger";
import { Command } from "./types";

// Import all commands manually (avoids fs/path issues in some compiled environments)
import banCommand from "./commands/moderation/ban";
import kickCommand from "./commands/moderation/kick";
import timeoutCommand from "./commands/moderation/timeout";
import warnCommand from "./commands/moderation/warn";
import clearCommand from "./commands/moderation/clear";
import unbanCommand from "./commands/moderation/unban";
import slowmodeCommand from "./commands/moderation/slowmode";
import { lockCommand, unlockCommand } from "./commands/moderation/lock";


import serverinfoCommand from "./commands/info/serverinfo";
import userinfoCommand from "./commands/info/userinfo";
import avatarCommand from "./commands/info/avatar";
import pingCommand from "./commands/info/ping";
import helpCommand from "./commands/info/help";
import profileCommand from "./commands/info/profile";

import roleCommand from "./commands/moderation/role";
import hideCommand from "./commands/moderation/hide";
import showCommand from "./commands/moderation/show";

import {
  setWelcomeCommand,
  setLeaveCommand,
  setLogsCommand,
  autoRoleCommand,
  embedCommand,
  antiRaidCommand,
} from "./commands/settings/settings";

import {
  protectionCommand,
  antiLinksCommand,
  antiSpamCommand,
  antiBotsCommand,
  antiSwearCommand,
} from "./commands/settings/protection";

import creditsCommand from "./commands/economy/credits";
import dailyCommand from "./commands/economy/daily";
import repCommand from "./commands/economy/rep";

import rankCommand from "./commands/levels/rank";
import topCommand from "./commands/levels/top";

import rollCommand from "./commands/fun/roll";
import coinflipCommand from "./commands/fun/coinflip";

// Import Events
import readyEvent from "./events/ready";
import messageCreateEvent from "./events/messageCreate";
import interactionCreateEvent from "./events/interactionCreate";
import guildMemberAddEvent from "./events/guildMemberAdd";
import guildMemberRemoveEvent from "./events/guildMemberRemove";
import { messageDeleteEvent, messageUpdateEvent } from "./events/messageLogs";
import voiceStateUpdateEvent from "./events/voiceStateUpdate";
import channelDeleteEvent from "./events/channelDelete";
import channelCreateEvent from "./events/channelCreate";
import roleDeleteEvent from "./events/roleDelete";
import roleCreateEvent from "./events/roleCreate";
import guildBanAddEvent from "./events/guildBanAdd";


import bombCommand from "./commands/games/bomb";
import guessCommand from "./commands/games/guess";
import luckyCommand from "./commands/games/lucky";
import rouletteCommand from "./commands/games/roulette";
import triviaCommand from "./commands/games/trivia";
import truthordareCommand from "./commands/games/truthordare";
import typeraceCommand from "./commands/games/typerace";
import wordchainCommand from "./commands/games/wordchain";

const allCommands = [

  bombCommand,
  guessCommand,
  luckyCommand,
  rouletteCommand,
  triviaCommand,
  truthordareCommand,
  typeraceCommand,
  wordchainCommand,

  banCommand,
  kickCommand,
  timeoutCommand,
  warnCommand,
  clearCommand,
  unbanCommand,
  slowmodeCommand,
  lockCommand,
  unlockCommand,

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
  channelDeleteEvent,
  channelCreateEvent,
  roleDeleteEvent,
  roleCreateEvent,
  guildBanAddEvent,
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
    GatewayIntentBits.GuildModeration,
    GatewayIntentBits.GuildBans,
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

async function deploySlashCommands() {
  if (!Config.token || !Config.clientId) {
    Logger.warn("Skipping command deployment: missing token or clientId");
    return;
  }
  const commandData = allCommands.map((c) => c.data.toJSON());
  const rest = new REST({ version: "10" }).setToken(Config.token);
  try {
    Logger.info(`Started refreshing ${commandData.length} application (/) commands.`);
    if (Config.guildId) {
      await rest.put(Routes.applicationGuildCommands(Config.clientId, Config.guildId), {
        body: commandData,
      });
      Logger.success(`Successfully deployed ${commandData.length} commands to guild ${Config.guildId}`);
    } else {
      await rest.put(Routes.applicationCommands(Config.clientId), {
        body: commandData,
      });
      Logger.success(`Successfully deployed ${commandData.length} commands globally`);
    }
  } catch (err) {
    Logger.error(`Failed to deploy commands: ${err}`);
  }
}

async function start() {
  await deploySlashCommands();
}

// Start the bot
start().then(() => client.login(Config.token)).catch((err) => {
  Logger.error(`Failed to login: ${err}`);
});
// Trigger deployment
