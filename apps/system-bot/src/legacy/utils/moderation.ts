import { ChatInputCommandInteraction, GuildMember, PermissionFlagsBits, PermissionsBitField } from "discord.js";
import { errorEmbed } from "./embed.js";
import { isOwner } from "./permissions.js";

async function replyError(interaction: ChatInputCommandInteraction, title: string, description: string) {
  const payload = { embeds: [errorEmbed(title, description)], ephemeral: true };
  if (interaction.replied || interaction.deferred) return interaction.followUp(payload).catch(() => null);
  return interaction.reply(payload).catch(() => null);
}

export async function fetchMember(interaction: ChatInputCommandInteraction, userId: string): Promise<GuildMember | null> {
  return interaction.guild?.members.fetch(userId).catch(() => null) ?? null;
}

export async function ensureBotPermission(
  interaction: ChatInputCommandInteraction,
  permission: bigint,
  actionLabel: string,
): Promise<boolean> {
  const botMember = interaction.guild?.members.me ?? (await interaction.guild?.members.fetchMe().catch(() => null));
  if (botMember?.permissions.has(permission)) return true;
  const name = new PermissionsBitField(permission).toArray()[0] ?? "الصلاحية المطلوبة";
  await replyError(
    interaction,
    `Cannot ${actionLabel}`,
    `البوت ما عنده صلاحية **${name}**. عطه الصلاحية أو Administrator ثم جرّب من جديد.`,
  );
  return false;
}

export async function ensureCanModerateTarget(
  interaction: ChatInputCommandInteraction,
  targetMember: GuildMember,
  actionLabel: string,
): Promise<boolean> {
  const actor = interaction.member as GuildMember;
  const botMember = interaction.guild?.members.me ?? (await interaction.guild?.members.fetchMe().catch(() => null));

  if (!interaction.guild || !botMember) return false;

  if (targetMember.id === interaction.guild.ownerId) {
    await replyError(interaction, `Cannot ${actionLabel}`, "ما أقدر أطبّق الإجراء على مالك السيرفر.");
    return false;
  }

  if (targetMember.id === botMember.id) {
    await replyError(interaction, `Cannot ${actionLabel}`, "ما أقدر أطبّق الإجراء على نفسي.");
    return false;
  }

  if (targetMember.id === actor.id) {
    await replyError(interaction, `Cannot ${actionLabel}`, "ما تقدر تطبّق هذا الإجراء على نفسك.");
    return false;
  }

  if (!isOwner(actor.id) && actor.id !== interaction.guild.ownerId && actor.roles.highest.position <= targetMember.roles.highest.position) {
    await replyError(
      interaction,
      `Cannot ${actionLabel}`,
      [
        "رتبة العضو أعلى أو مساوية لأعلى رتبة عندك.",
        `**رتبتك:** ${actor.roles.highest}`,
        `**رتبة العضو:** ${targetMember.roles.highest}`,
        "الحل: نفّذ الأمر على عضو رتبته أقل منك أو ارفع رتبتك فوق رتبته.",
      ].join("\n"),
    );
    return false;
  }

  if (botMember.roles.highest.position <= targetMember.roles.highest.position) {
    await replyError(
      interaction,
      `Cannot ${actionLabel}`,
      [
        "رتبة البوت أقل أو مساوية لرتبة العضو، وDiscord يمنع البوت من التحكم فيه حتى لو عنده Administrator.",
        `**أعلى رتبة للبوت:** ${botMember.roles.highest}`,
        `**أعلى رتبة للعضو:** ${targetMember.roles.highest}`,
        "الحل الجذري: Server Settings → Roles ثم اسحب رتبة البوت فوق رتبة العضو/الإدارة المطلوبة.",
      ].join("\n"),
    );
    return false;
  }

  return true;
}

export async function ensureCanManageRole(
  interaction: ChatInputCommandInteraction,
  rolePosition: number,
  roleLabel: string,
): Promise<boolean> {
  const actor = interaction.member as GuildMember;
  const botMember = interaction.guild?.members.me ?? (await interaction.guild?.members.fetchMe().catch(() => null));
  if (!botMember || !interaction.guild) return false;

  if (!isOwner(actor.id) && actor.id !== interaction.guild.ownerId && rolePosition >= actor.roles.highest.position) {
    await replyError(interaction, "Cannot Manage Role", `رتبة ${roleLabel} أعلى أو مساوية لرتبتك. لازم تكون رتبتك فوقها.`);
    return false;
  }

  if (rolePosition >= botMember.roles.highest.position) {
    await replyError(interaction, "Cannot Manage Role", `رتبة ${roleLabel} أعلى أو مساوية لرتبة البوت. ارفع رتبة البوت فوقها من إعدادات الرتب.`);
    return false;
  }

  return true;
}

export const BOT_PERMISSIONS = {
  ban: PermissionFlagsBits.BanMembers,
  kick: PermissionFlagsBits.KickMembers,
  timeout: PermissionFlagsBits.ModerateMembers,
  messages: PermissionFlagsBits.ManageMessages,
  channels: PermissionFlagsBits.ManageChannels,
  roles: PermissionFlagsBits.ManageRoles,
  nicknames: PermissionFlagsBits.ManageNicknames,
};
