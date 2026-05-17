// ══════════════════════════════════════════════════════════════
//  /warn — Warn a member
//  V2 — Application Emojis, no Unicode emojis
// ══════════════════════════════════════════════════════════════

import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  GuildMember,
} from "discord.js";
import { Command } from "../../types";
import { modEmbed, errorEmbed, successEmbed } from "../../utils/embed";
import { isModerator, noPermission } from "../../utils/permissions";
import { getGuildConfig } from "../../db/guilds";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("warn")
    .setDescription("Warn a member")
    .addUserOption((o) => o.setName("user").setDescription("The user to warn").setRequired(true))
    .addStringOption((o) => o.setName("reason").setDescription("Reason for the warning").setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  async execute(interaction: ChatInputCommandInteraction) {
    const member = interaction.member as GuildMember;
    const allowedWarnRoles = [
      "1483021366792949760",
      "1483212264025886886",
      "1483021857048232036",
      "1483020652997771284",
      "1483211847875297512",
      "1483021277181644842",
      "1483021186559639674",
      "1483825953246544012",
      "1494069372526923847",
      "1483020976966074479",
      "1482858415469367336",
      "1483038264393990164"
    ];
    const hasRole = member.roles.cache.some((role) => allowedWarnRoles.includes(role.id)) ||
                    member.id === interaction.guild?.ownerId;
    if (!hasRole) return noPermission(interaction);

    const target = interaction.options.getUser("user", true);
    const reason = interaction.options.getString("reason", true);

    try {
      try {
        await target.send({
          embeds: [
            modEmbed(
              "You have been warned",
              `**Server:** ${interaction.guild?.name}\n**Reason:** ${reason}\n**Moderator:** ${interaction.user.tag}`,
            ),
          ],
        });
      } catch {}

      await interaction.reply({
        embeds: [
          successEmbed(
            "Member Warned",
            `**User:** ${target.tag} (\`${target.id}\`)\n**Reason:** ${reason}`,
          ).setThumbnail(target.displayAvatarURL()),
        ],
      });

      const dbConfig = await getGuildConfig(interaction.guildId!);
      const logsChannel = interaction.guild?.channels.cache.get(dbConfig.channels.logs_channel ?? "");
      if (logsChannel?.isTextBased()) {
        await logsChannel.send({
          embeds: [
            modEmbed(
              "Member Warned",
              `**User:** ${target.tag} (\`${target.id}\`)\n**Moderator:** ${interaction.user.tag}\n**Reason:** ${reason}`,
            ).setThumbnail(target.displayAvatarURL()),
          ],
        });
      }
    } catch {
      await interaction.reply({
        embeds: [errorEmbed("Warn Failed", "Something went wrong.")],
        ephemeral: true,
      });
    }
  },
};

export default command;
