// ══════════════════════════════════════════════════════════════
//  Opus System Bot — Entry Point (V2)
// ══════════════════════════════════════════════════════════════

import { Client, GatewayIntentBits, Partials, Collection } from "discord.js";
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
import nukeCommand from "./commands/moderation/nuke";

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

const allCommands = [
  banCommand,
  kickCommand,
  timeoutCommand,
  warnCommand,
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

// Start the bot
client.login(Config.token).catch((err) => {
  Logger.error(`Failed to login: ${err}`);
});
// Trigger deployment
