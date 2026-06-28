import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { Command } from '../../types';

const activeGames = new Map<string, string>();

const command: Command = {
  cooldown: 10,
  data: new SlashCommandBuilder()
    .setName('bomb')
    .setDescription('القنبلة الموقوتة — مررها قبل ما تنفجر!')
    .addUserOption(opt => opt.setName('target').setDescription('من تمرر له القنبلة').setRequired(true)) as SlashCommandBuilder,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const target = interaction.options.getUser('target', true);

    if (target.bot) {
      await interaction.reply({ content: '❌ لا تقدر تمرر القنبلة لبوت!', ephemeral: true });
      return;
    }

    if (activeGames.get(interaction.channelId)) {
      await interaction.reply({ content: '⚠️ يوجد لعبة نشطة في هذه القناة!', ephemeral: true });
      return;
    }

    activeGames.set(interaction.channelId, target.id);
    const timeLimit = 10;

    await interaction.reply({
      embeds: [new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle('💣 القنبلة الموقوتة!')
        .setDescription(`${interaction.user} مرر القنبلة لـ ${target}!\n\n${target} عندك **${timeLimit} ثواني** تمررها لشخص ثاني!\n\nاكتب منشن لشخص تمرر له القنبلة!`)
        .setTimestamp()]
    });

    const filter = (m: any) => m.author.id === target.id && m.mentions.users.size > 0;
    const collector = interaction.channel?.createMessageCollector({ filter, time: timeLimit * 1000 });

    collector?.on('collect', async (msg) => {
      const next = msg.mentions.users.first();
      if (!next || next.bot || next.id === target.id) return;

      collector.stop('passed');
      activeGames.set(interaction.channelId, next.id);

      await msg.reply({
        embeds: [new EmbedBuilder()
          .setColor(0xff6600)
          .setTitle('💣 تم التمرير!')
          .setDescription(`${target} مرر القنبلة لـ ${next}!\n\n${next} عندك **${timeLimit} ثواني**!`)
          .setTimestamp()]
      });

      const nextFilter = (m: any) => m.author.id === next.id && m.mentions.users.size > 0;
      const nextCollector = interaction.channel?.createMessageCollector({ filter: nextFilter, time: timeLimit * 1000 });

      nextCollector?.on('end', async (_, reason) => {
        activeGames.delete(interaction.channelId);
        if (reason !== 'passed') {
          await interaction.followUp({
            embeds: [new EmbedBuilder()
              .setColor(0xe74c3c)
              .setTitle('💥 انفجرت القنبلة!')
              .setDescription(`${next} خسر! القنبلة انفجرت بيده 💥`)
              .setTimestamp()]
          });
        }
      });
    });

    collector?.on('end', async (_, reason) => {
      if (reason !== 'passed') {
        activeGames.delete(interaction.channelId);
        await interaction.followUp({
          embeds: [new EmbedBuilder()
            .setColor(0xe74c3c)
            .setTitle('💥 انفجرت القنبلة!')
            .setDescription(`${target} خسر! ما قدر يمرر القنبلة في الوقت 💥`)
            .setTimestamp()]
        });
      }
    });
  }
};

export default command;
