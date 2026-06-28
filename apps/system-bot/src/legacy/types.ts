// ══════════════════════════════════════════════════════════════
//  Opus System Bot — Type Definitions
// ══════════════════════════════════════════════════════════════

import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  SlashCommandSubcommandsOnlyBuilder,
  SlashCommandOptionsOnlyBuilder,
  Client,
  ClientEvents,
} from "discord.js";

/** Slash command structure */
export interface Command {
  data:
    | SlashCommandBuilder
    | SlashCommandSubcommandsOnlyBuilder
    | SlashCommandOptionsOnlyBuilder
    | Omit<SlashCommandBuilder, "addSubcommand" | "addSubcommandGroup">;
  execute: (interaction: ChatInputCommandInteraction) => Promise<any>;
  ownerOnly?: boolean;
}

/** Event handler structure */
export interface BotEvent<K extends keyof ClientEvents = keyof ClientEvents> {
  name: K;
  once?: boolean;
  execute: (client: Client, ...args: ClientEvents[K]) => void | Promise<void>;
}
