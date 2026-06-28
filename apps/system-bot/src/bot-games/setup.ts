import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  EmbedBuilder,
} from 'discord.js';
import { Command } from '../../types';
import { setServerConfig, getServerConfig } from '../../utils/database';
import { successEmbed, errorEmbed } from '../../utils/embed';

const command: Command = {
  cooldown: 5,
  data: new SlashCommandBuilder()
    .setName('setup')
    .setDescription('إعداد نظام السيرفر')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(sub =>
      sub.setName('welcome')
        .setDescription('تعيين قناة الترحيب')
        .addChannelOption(opt => opt.setName('channel').setDescription('القناة').setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName('goodbye')
        .setDescription('تعيين قناة الوداع')
        .addChannelOption(opt => opt.setName('channel').setDescription('القناة').setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName('log')
        .setDescription('تعيين قناة السجلات')
        .addChannelOption(opt => opt.setName('channel').setDescription('القناة').setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName('verify')
        .setDescription('إعداد نظام التحقق')
        .addChannelOption(opt => opt.setName('channel').setDescription('قناة التحقق').setRequired(true))
        .addRoleOption(opt => opt.setName('unverified').setDescription('رتبة غير محقق').setRequired(true))
        .addRoleOption(opt => opt.setName('verified').setDescription('رتبة محقق').setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName('role')
        .setDescription('تعيين رتبة تلقائية')
        .addRoleOption(opt => opt.setName('role').setDescription('الرتبة').setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName('admin')
        .setDescription('قناة إشعارات الإدارة')
        .addChannelOption(opt => opt.setName('channel').setDescription('القناة').setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName('status')
        .setDescription('عرض الإعدادات الحالية')
    ) as SlashCommandBuilder,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guildId!;

    if (sub === 'welcome') {
      const channel = interaction.options.getChannel('channel', true);
      setServerConfig(guildId, { welcomeChannelId: channel.id });
      await interaction.reply({ embeds: [successEmbed('تم الإعداد', `قناة الترحيب: ${channel}`)], ephemeral: true });
    }

    else if (sub === 'goodbye') {
      const channel = interaction.options.getChannel('channel', true);
      setServerConfig(guildId, { goodbyeChannelId: channel.id });
      await interaction.reply({ embeds: [successEmbed('تم الإعداد', `قناة الوداع: ${channel}`)], ephemeral: true });
    }

    else if (sub === 'log') {
      const channel = interaction.options.getChannel('channel', true);
      setServerConfig(guildId, { logChannelId: channel.id });
      await interaction.reply({ embeds: [successEmbed('تم الإعداد', `قناة السجلات: ${channel}`)], ephemeral: true });
    }

    else if (sub === 'verify') {
      const channel = interaction.options.getChannel('channel', true);
      const unverified = interaction.options.getRole('unverified', true);
      const verified = interaction.options.getRole('verified', true);

      setServerConfig(guildId, {
        verificationChannelId: channel.id,
        unverifiedRoleId: unverified.id,
        verifiedRoleId: verified.id,
      });

      const verifyChannel = interaction.guild?.channels.cache.get(channel.id);
      if (verifyChannel?.isTextBased()) {
        const embed = new EmbedBuilder()
          .setColor(0x3498db)
          .setTitle('✅ التحقق من الهوية')
          .setDescription('اضغط على الزر أدناه للتحقق والدخول للسيرفر.')
          .setTimestamp();

        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId('verify_button')
            .setLabel('تحقق الآن ✅')
            .setStyle(ButtonStyle.Success)
        );

        await (verifyChannel as any).send({ embeds: [embed], components: [row] });
      }

      await interaction.reply({ embeds: [successEmbed('تم إعداد التحقق', `القناة: ${channel}`)], ephemeral: true });
    }

    else if (sub === 'role') {
      const role = interaction.options.getRole('role', true);
      setServerConfig(guildId, { defaultRoleId: role.id });
      await interaction.reply({ embeds: [successEmbed('تم الإعداد', `الرتبة التلقائية: ${role}`)], ephemeral: true });
    }

    else if (sub === 'admin') {
      const channel = interaction.options.getChannel('channel', true);
      setServerConfig(guildId, { adminChannelId: channel.id });
      await interaction.reply({ embeds: [successEmbed('تم الإعداد', `قناة الإدارة: ${channel}`)], ephemeral: true });
    }

    else if (sub === 'status') {
      const cfg = getServerConfig(guildId);
      const embed = new EmbedBuilder()
        .setColor(0x3498db)
        .setTitle('⚙️ إعدادات السيرفر الحالية')
        .addFields(
          { name: '👋 الترحيب', value: cfg.welcomeChannelId ? `<#${cfg.welcomeChannelId}>` : 'غير محدد', inline: true },
          { name: '👋 الوداع', value: cfg.goodbyeChannelId ? `<#${cfg.goodbyeChannelId}>` : 'غير محدد', inline: true },
          { name: '📋 السجلات', value: cfg.logChannelId ? `<#${cfg.logChannelId}>` : 'غير محدد', inline: true },
          { name: '✅ التحقق', value: cfg.verificationChannelId ? `<#${cfg.verificationChannelId}>` : 'غير محدد', inline: true },
          { name: '🔰 الرتبة التلقائية', value: cfg.defaultRoleId ? `<@&${cfg.defaultRoleId}>` : 'غير محدد', inline: true },
          { name: '📢 الإدارة', value: cfg.adminChannelId ? `<#${cfg.adminChannelId}>` : 'غير محدد', inline: true },
        )
        .setTimestamp();

      await interaction.reply({ embeds: [embed], ephemeral: true });
    }
  }
};

export default command;
