// ══════════════════════════════════════════════════════════════
//  /role — Add or remove a role from a user
// ══════════════════════════════════════════════════════════════

import { SlashCommandBuilder, ChatInputCommandInteraction, Role } from "discord.js";
import { Command } from "../../types.js";
import { errorEmbed, successEmbed } from "../../utils/embed.js";
import { requireCommandAccess } from "../../utils/permissions.js";
import { BOT_PERMISSIONS, ensureBotPermission, ensureCanManageRole, fetchMember } from "../../utils/moderation.js";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("role")
    .setDescription("Add or remove a role from a member")
    .addUserOption((o) => o.setName("user").setDescription("The user to manage").setRequired(true))
    .addRoleOption((o) => o.setName("role").setDescription("The role to add or remove").setRequired(true)),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!(await requireCommandAccess(interaction, "role"))) return;
    if (!(await ensureBotPermission(interaction, BOT_PERMISSIONS.roles, "Role"))) return;

    const targetUser = interaction.options.getUser("user", true);
    const role = interaction.options.getRole("role", true) as Role;
    const targetMember = await fetchMember(interaction, targetUser.id);

    if (!targetMember) return interaction.reply({ embeds: [errorEmbed("Error", "Member not found in this server.")], ephemeral: true });
    if (role.id === interaction.guildId) return interaction.reply({ embeds: [errorEmbed("Error", "ما أقدر أدير رتبة @everyone.")], ephemeral: true });
    if (role.managed) return interaction.reply({ embeds: [errorEmbed("Error", "هذه رتبة managed من Discord/Integration وما تنضاف يدوياً.")], ephemeral: true });
    if (!(await ensureCanManageRole(interaction, role.position, `${role}`))) return;

    try {
      if (targetMember.roles.cache.has(role.id)) {
        await targetMember.roles.remove(role.id, `Role removed by ${interaction.user.tag}`);
        return interaction.reply({ embeds: [successEmbed("Role Removed", `Successfully removed ${role} from ${targetUser}.`)] });
      }

      await targetMember.roles.add(role.id, `Role added by ${interaction.user.tag}`);
      return interaction.reply({ embeds: [successEmbed("Role Added", `Successfully added ${role} to ${targetUser}.`)] });
    } catch {
      return interaction.reply({ embeds: [errorEmbed("Error", "فشل تحديث الرتبة. تأكد أن رتبة البوت فوق الرتبة المطلوبة.")], ephemeral: true });
    }
  },
};

export default command;
