// ══════════════════════════════════════════════════════════════
//  Deploy Slash Commands to Discord API
//  Run: npx ts-node src/deploy-commands.ts
//  V2 — Added antiswear command
// ══════════════════════════════════════════════════════════════

import { REST, Routes } from "discord.js";
import { Config } from "./config.js";
import { Logger } from "./utils/logger.js";

// Import all commands
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

const commandData = allCommands.map((c) => c.data.toJSON());

const rest = new REST({ version: "10" }).setToken(Config.token);

(async () => {
  try {
    Logger.info(`Deploying ${commandData.length} slash commands...`);

    if (Config.guildId) {
      // Guild-specific (instant, for development)
      await rest.put(Routes.applicationGuildCommands(Config.clientId, Config.guildId), {
        body: commandData,
      });
      Logger.success(`Deployed ${commandData.length} commands to guild ${Config.guildId}`);
    } else {
      // Global (takes ~1 hour to propagate)
      await rest.put(Routes.applicationCommands(Config.clientId), {
        body: commandData,
      });
      Logger.success(`Deployed ${commandData.length} commands globally`);
    }
  } catch (err) {
    Logger.error(`Failed to deploy commands: ${err}`);
  }
})();
