// ══════════════════════════════════════════════════════════════
//  Deploy Slash Commands to Discord API
//  Run: npx ts-node src/deploy-commands.ts
// ══════════════════════════════════════════════════════════════

import { REST, Routes } from "discord.js";
import { Config } from "./config";
import { Logger } from "./utils/logger";

// Import all commands
import banCommand from "./commands/moderation/ban";
import kickCommand from "./commands/moderation/kick";
import timeoutCommand from "./commands/moderation/timeout";
import warnCommand from "./commands/moderation/warn";
import clearCommand from "./commands/moderation/clear";
import unbanCommand from "./commands/moderation/unban";
import slowmodeCommand from "./commands/moderation/slowmode";
import { lockCommand, unlockCommand } from "./commands/moderation/lock";
import antinukeCommand from "./commands/moderation/antinuke";

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

import { protectionCommand } from "./commands/settings/protection";

import creditsCommand from "./commands/economy/credits";
import dailyCommand from "./commands/economy/daily";
import repCommand from "./commands/economy/rep";

import rankCommand from "./commands/levels/rank";
import topCommand from "./commands/levels/top";

import rollCommand from "./commands/fun/roll";
import coinflipCommand from "./commands/fun/coinflip";

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
  antinukeCommand,

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
  protectionCommand,

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

const commandData = allCommands.map((c) => c.data.toJSON());

const rest = new REST({ version: "10" }).setToken(Config.token);

(async () => {
  try {
    Logger.info(`Deploying ${commandData.length} slash commands...`);

    if (Config.guildId) {
      await rest.put(Routes.applicationGuildCommands(Config.clientId, Config.guildId), {
        body: commandData,
      });
      Logger.success(`Deployed ${commandData.length} commands to guild ${Config.guildId}`);
    } else {
      await rest.put(Routes.applicationCommands(Config.clientId), {
        body: commandData,
      });
      Logger.success(`Deployed ${commandData.length} commands globally`);
    }
  } catch (err) {
    Logger.error(`Failed to deploy commands: ${err}`);
  }
})();
