import { ChatInputCommandInteraction, SlashCommandBuilder, Client, Collection } from 'discord.js';

export interface Command {
  data: Omit<SlashCommandBuilder, 'addSubcommand' | 'addSubcommandGroup'> | SlashCommandBuilder;
  execute: (interaction: ChatInputCommandInteraction) => Promise<void>;
  cooldown?: number;
}

export interface ExtendedClient extends Client {
  commands: Collection<string, Command>;
  cooldowns: Collection<string, Collection<string, number>>;
}

export interface ServerConfig {
  welcomeChannelId?: string;
  goodbyeChannelId?: string;
  logChannelId?: string;
  verificationChannelId?: string;
  adminChannelId?: string;
  defaultRoleId?: string;
  verifiedRoleId?: string;
  unverifiedRoleId?: string;
  rules: string[];
}

export interface GameSession {
  active: boolean;
  players: string[];
  currentPlayer?: string;
  data?: Record<string, unknown>;
}
