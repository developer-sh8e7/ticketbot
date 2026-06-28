import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits, EmbedBuilder } from 'discord.js';
import { Command } from '../../types';
import { getServerConfig, setServerConfig } from '../../utils/database';
import { successEmbed, errorEmbed } from '../../utils/embed';

const command: Command = {
  cooldown: 5,
  data: new SlashCommandBuilder()
    .setName('rules')
    .setDescription('إدارة قوانين السيرفر')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(sub => sub.setName('show').setDescription('عرض القوانين'))
    .addSubcommand(sub =>
      sub.setName('add')
        .setDescription('إضافة قانون')
        .addStringOption((opt: any) => opt.setName('rule').setDescription('نص القانون').setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName('remove')
        .setDescription('حذف قانون')
        .addIntegerOption((opt: any) => opt.setName('number').setDescription('رقم القانون').setRequired(true).setMinValue(1))
    ) as SlashCommandBuilder,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const sub = interaction.options.getSubcommand();
    const config = getServerConfig(interaction.guildId!);

    if (sub === 'show') {
      if (config.rules.length === 0) {
        await interaction.reply({ embeds: [errorEmbed('لا توجد قوانين مضافة بعد.')], ephemeral: true });
        return;
      }
      const rulesText = config.rules.map((r, i) => `**${i + 1}.** ${r}`).join('\n\n');
      const embed = new EmbedBuilder()
        .setColor(0xe74c3c)
        .setTitle(`📜 قوانين ${interaction.guild?.name}`)
        .setDescription(rulesText)
        .setThumbnail(interaction.guild?.iconURL() || null)
        .setFooter({ text: 'يرجى الالتزام بالقوانين للجميع.' })
        .setTimestamp();
      await interaction.reply({ embeds: [embed] });
    } else if (sub === 'add') {
      const rule = interaction.options.getString('rule', true);
      config.rules.push(rule);
      setServerConfig(interaction.guildId!, { rules: config.rules });
      await interaction.reply({ embeds: [successEmbed('تم الإضافة', `القانون رقم **${config.rules.length}**: ${rule}`)], ephemeral: true });
    } else if (sub === 'remove') {
      const num = interaction.options.getInteger('number', true);
      if (num > config.rules.length) {
        await interaction.reply({ embeds: [errorEmbed(`رقم القانون غير موجود. الأقصى: ${config.rules.length}`)], ephemeral: true });
        return;
      }
      const removed = config.rules.splice(num - 1, 1)[0];
      setServerConfig(interaction.guildId!, { rules: config.rules });
      await interaction.reply({ embeds: [successEmbed('تم الحذف', `تم حذف القانون: ${removed}`)], ephemeral: true });
    }
  }
};

export default command;
