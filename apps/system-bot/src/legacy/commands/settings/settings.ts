// ══════════════════════════════════════════════════════════════
//  Settings Commands (Welcome, Leave, Logs, AutoRole)
//  V2 — Application Emojis, no Unicode emojis
// ══════════════════════════════════════════════════════════════

import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
} from "discord.js";
import { Command } from "../../types.js";
import { updateGuildSetting } from "../../db/guilds.js";
import { successEmbed, errorEmbed } from "../../utils/embed.js";
import { Emojis } from "../../utils/emojis.js";

// ── Generic Setting Factory ──────────────────────────────────
function createSettingCommand(
  name: string,
  description: string,
  dbField: "welcome_channel" | "leave_channel" | "logs_channel" | "join_leave_logs_channel" | "message_logs_channel" | "voice_logs_channel",
  emoji: string,
): Command {
  return {
    data: new SlashCommandBuilder()
      .setName(name)
      .setDescription(description)
      .addChannelOption((o) =>
        o.setName("channel").setDescription("The channel to set (leave empty to disable)"),
      )
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

    async execute(interaction: ChatInputCommandInteraction) {
      await interaction.deferReply();
      const channel = interaction.options.getChannel("channel");

      try {
        await updateGuildSetting(interaction.guildId!, "guild_channels", {
          [dbField]: channel?.id ?? null,
        });

        if (channel) {
          return interaction.editReply({
            embeds: [successEmbed("Settings Updated", `${emoji} Updated successfully to ${channel}.`)],
          });
        } else {
          return interaction.editReply({
            embeds: [successEmbed("Settings Updated", `${emoji} Disabled successfully.`)],
          });
        }
      } catch {
        return interaction.editReply({
          embeds: [errorEmbed("Error", "Failed to update database.")],
        });
      }
    },
  };
}

export const setWelcomeCommand = createSettingCommand(
  "setwelcome",
  "Set the channel for welcome messages",
  "welcome_channel",
  Emojis.welcome,
);

export const setLeaveCommand = createSettingCommand(
  "setleave",
  "Set the channel for leave messages",
  "leave_channel",
  Emojis.leave,
);

export const setLogsCommand = createSettingCommand(
  "setlogs",
  "Set the channel for moderation logs",
  "logs_channel",
  Emojis.logs,
);

// ── Auto-Role Command ───────────────────────────────────────
export const autoRoleCommand: Command = {
  data: new SlashCommandBuilder()
    .setName("autorole")
    .setDescription("Set the role given to new members automatically")
    .addRoleOption((o) =>
      o.setName("role").setDescription("The role to set (leave empty to disable)"),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();
    const role = interaction.options.getRole("role");

    try {
      await updateGuildSetting(interaction.guildId!, "guild_roles", {
        auto_role: role?.id ?? null,
      });

      if (role) {
        return interaction.editReply({
          embeds: [successEmbed("Settings Updated", `${Emojis.autorole} Auto-role set to ${role}.`)],
        });
      } else {
        return interaction.editReply({
          embeds: [successEmbed("Settings Updated", `${Emojis.autorole} Auto-role disabled.`)],
        });
      }
    } catch {
      return interaction.editReply({
        embeds: [errorEmbed("Error", "Failed to update database.")],
      });
    }
  },
};

// ── Embed Color Command ─────────────────────────────────────
export const embedCommand: Command = {
  data: new SlashCommandBuilder()
    .setName("embed")
    .setDescription("Set the default color for server embeds")
    .addStringOption((o) =>
      o
        .setName("hex")
        .setDescription("Hex color code (e.g. #FF0000 or FF0000) (empty to reset)")
        .setMinLength(6)
        .setMaxLength(7),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();
    const hex = interaction.options.getString("hex");

    let cleanHex = hex?.replace("#", "") ?? null;
    if (cleanHex && !/^[0-9A-Fa-f]{6}$/.test(cleanHex)) {
      return interaction.editReply({
        embeds: [errorEmbed("Invalid Color", "Please provide a valid 6-character hex code.")],
      });
    }

    try {
      await updateGuildSetting(interaction.guildId!, "guilds", {
        embed_color: cleanHex,
      });

      return interaction.editReply({
        embeds: [
          successEmbed(
            "Settings Updated",
            cleanHex
              ? `${Emojis.embed} Default embed color set to **#${cleanHex}**.`
              : `${Emojis.embed} Default embed color reset to default.`,
          ),
        ],
      });
    } catch {
      return interaction.editReply({
        embeds: [errorEmbed("Error", "Failed to update database.")],
      });
    }
  },
};

// ── Anti-Raid Command ───────────────────────────────────────
export const antiRaidCommand: Command = {
  data: new SlashCommandBuilder()
    .setName("antiraid")
    .setDescription("Toggle Anti-Raid protection (kicks accounts newer than 7 days)")
    .addStringOption((o) =>
      o
        .setName("state")
        .setDescription("Enable or disable")
        .setRequired(true)
        .addChoices(
          { name: "Enable", value: "enable" },
          { name: "Disable", value: "disable" },
        ),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();
    const state = interaction.options.getString("state", true) === "enable";

    try {
      // Lazy import to avoid circular dependencies
      const { updateGuildSetting } = await import("../../db/guilds.js");
      await updateGuildSetting(interaction.guildId!, "guild_modules", {
        antiraid_enabled: state,
      });

      return interaction.editReply({
        embeds: [
          successEmbed(
            "Settings Updated",
            `${Emojis.antiraid} Anti-Raid protection has been **${state ? "enabled" : "disabled"}**.`,
          ),
        ],
      });
    } catch {
      return interaction.editReply({
        embeds: [errorEmbed("Error", "Failed to update database.")],
      });
    }
  },
};
