// ══════════════════════════════════════════════════════════════
//  Protection Commands (Anti-Spam, Anti-Links, Anti-Bots, Anti-Swear)
//  V2 — Application Emojis, no Unicode emojis
// ══════════════════════════════════════════════════════════════

import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits } from "discord.js";
import { Command } from "../../types.js";
import { updateGuildSetting } from "../../db/guilds.js";
import { successEmbed, errorEmbed } from "../../utils/embed.js";
import { Emojis } from "../../utils/emojis.js";

// ── Unified Protection Command ─────────────────────────────
export const protectionCommand: Command = {
  data: new SlashCommandBuilder()
    .setName("protection")
    .setDescription("Toggle various protection modules (Anti-Swear, Anti-Spam, etc.)")
    .addStringOption((o) =>
      o
        .setName("module")
        .setDescription("The protection module to configure")
        .setRequired(true)
        .addChoices(
          { name: "Anti-Swear (Profanity Filter)", value: "antiswear_enabled" },
          { name: "Anti-Spam (Mass Mentions/Duplicates)", value: "antispam_enabled" },
          { name: "Anti-Links (Blocks Links)", value: "antilinks_enabled" },
          { name: "Anti-Bots (Blocks Bots)", value: "antibots_enabled" },
        ),
    )
    .addStringOption((o) =>
      o
        .setName("state")
        .setDescription("Enable or disable the module")
        .setRequired(true)
        .addChoices(
          { name: "Enable", value: "enable" },
          { name: "Disable", value: "disable" },
        ),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();
    const moduleKey = interaction.options.getString("module", true) as any;
    const state = interaction.options.getString("state", true) === "enable";

    const moduleNames: Record<string, string> = {
      antiswear_enabled: "Anti-Swear",
      antispam_enabled: "Anti-Spam",
      antilinks_enabled: "Anti-Links",
      antibots_enabled: "Anti-Bots",
    };

    const moduleEmojis: Record<string, string> = {
      antiswear_enabled: Emojis.antiswear,
      antispam_enabled: Emojis.antispam,
      antilinks_enabled: Emojis.antilinks,
      antibots_enabled: Emojis.antibots,
    };

    try {
      await updateGuildSetting(interaction.guildId!, "guild_modules", {
        [moduleKey]: state,
      });

      return interaction.editReply({
        embeds: [
          successEmbed(
            "Protection Updated",
            `${moduleEmojis[moduleKey]} The \`${moduleNames[moduleKey]}\` module has been **${state ? "enabled" : "disabled"}**.`,
          ),
        ],
      });
    } catch (err) {
      return interaction.editReply({
        embeds: [errorEmbed("Error", "Failed to update database.")],
      });
    }
  },
};

// Export individual commands as well for compatibility, or keep it clean with just unified
export const antiLinksCommand = protectionCommand;
export const antiSpamCommand = protectionCommand;
export const antiBotsCommand = protectionCommand;
export const antiSwearCommand = protectionCommand;

