import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { Command } from '../../types';

const command: Command = {
  cooldown: 10,
  data: new SlashCommandBuilder()
    .setName('roulette')
    .setDescription('روليت — تختار عضو عشوائي من السيرفر!') as SlashCommandBuilder,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    await interaction.deferReply();

    const members = interaction.guild?.members.cache.filter(m => !m.user.bot);
    if (!members || members.size === 0) {
      await interaction.editReply('❌ لا يوجد أعضاء في السيرفر.');
      return;
    }

    const frames = ['🎰 يدور...', '🎰 يدور..', '🎰 يدور.', '🎰 يدور..', '🎰 يدور...'];
    let i = 0;

    const msg = await interaction.editReply({
      embeds: [new EmbedBuilder().setColor(0x9b59b6).setTitle('🎰 روليت السيرفر').setDescription(frames[0]).setTimestamp()]
    });

    const interval = setInterval(async () => {
      i++;
      if (i < frames.length) {
        await interaction.editReply({
          embeds: [new EmbedBuilder().setColor(0x9b59b6).setTitle('🎰 روليت السيرفر').setDescription(frames[i]).setTimestamp()]
        });
      } else {
        clearInterval(interval);
        const arr = [...members.values()];
        const winner = arr[Math.floor(Math.random() * arr.length)];
        await interaction.editReply({
          embeds: [new EmbedBuilder()
            .setColor(0xf1c40f)
            .setTitle('🎰 نتيجة الروليت!')
            .setDescription(`تم اختيار: **${winner.user.username}** 🎉\n${winner}`)
            .setThumbnail(winner.user.displayAvatarURL())
            .setTimestamp()]
        });
      }
    }, 600);
  }
};

export default command;
