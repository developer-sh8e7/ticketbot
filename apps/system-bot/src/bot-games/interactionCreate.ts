import { Interaction, Collection } from 'discord.js';
import { ExtendedClient } from '../types';
import { errorEmbed } from '../utils/embed';
import { logger } from '../utils/logger';
import { getServerConfig, setServerConfig } from '../utils/database';

export const name = 'interactionCreate';
export const once = false;

export async function execute(interaction: Interaction, client: ExtendedClient): Promise<void> {
  // Handle slash commands
  if (interaction.isChatInputCommand()) {
    const command = client.commands.get(interaction.commandName);
    if (!command) return;

    // Cooldown check
    if (!client.cooldowns.has(command.data.name)) {
      client.cooldowns.set(command.data.name, new Collection());
    }

    const now = Date.now();
    const timestamps = client.cooldowns.get(command.data.name)!;
    const cooldownAmount = (command.cooldown ?? 3) * 1000;

    if (timestamps.has(interaction.user.id)) {
      const expiration = timestamps.get(interaction.user.id)! + cooldownAmount;
      if (now < expiration) {
        const remaining = ((expiration - now) / 1000).toFixed(1);
        await interaction.reply({
          embeds: [errorEmbed(`انتظر **${remaining}** ثانية قبل استخدام هذا الأمر مرة أخرى.`)],
          ephemeral: true,
        });
        return;
      }
    }

    timestamps.set(interaction.user.id, now);
    setTimeout(() => timestamps.delete(interaction.user.id), cooldownAmount);

    try {
      await command.execute(interaction);
    } catch (error) {
      logger.error(`Command error [${interaction.commandName}]: ${error}`);
      const reply = { embeds: [errorEmbed('حدث خطأ أثناء تنفيذ الأمر.')], ephemeral: true };
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(reply);
      } else {
        await interaction.reply(reply);
      }
    }
  }

  // Handle button interactions (verification)
  if (interaction.isButton()) {
    if (interaction.customId === 'verify_button') {
      try {
        const config = getServerConfig(interaction.guildId!);
        const member = interaction.guild?.members.cache.get(interaction.user.id);
        if (!member) return;

        if (config.unverifiedRoleId) {
          const unverifiedRole = interaction.guild?.roles.cache.get(config.unverifiedRoleId);
          if (unverifiedRole) await member.roles.remove(unverifiedRole);
        }

        if (config.verifiedRoleId) {
          const verifiedRole = interaction.guild?.roles.cache.get(config.verifiedRoleId);
          if (verifiedRole) await member.roles.add(verifiedRole);
        }

        await interaction.reply({ embeds: [{ color: 0x2ecc71, description: '✅ تم التحقق! أهلاً بك في السيرفر.' }], ephemeral: true });

        if (config.logChannelId) {
          const { EmbedBuilder } = await import('discord.js');
          const logChannel = interaction.guild?.channels.cache.get(config.logChannelId) as any;
          if (logChannel) {
            await logChannel.send({
              embeds: [new EmbedBuilder().setColor(0x2ecc71).setDescription(`✅ ${interaction.user} تم تحقيقه`).setTimestamp()]
            });
          }
        }
      } catch (error) {
        logger.error(`Verification error: ${error}`);
      }
    }
  }
}
