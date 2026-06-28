import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { Command } from '../../types';

const words = ['ديسكورد', 'برمجة', 'سيرفر', 'بوت', 'قناة', 'رتبة', 'لعبة', 'فائز', 'سؤال', 'إجابة'];
const activeGames = new Map<string, { word: string; guessed: Set<string>; wrong: number }>();

const command: Command = {
  cooldown: 10,
  data: new SlashCommandBuilder()
    .setName('guess')
    .setDescription('تخمين الكلمة — خمن الحروف قبل ما تنتهي المحاولات!') as SlashCommandBuilder,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    if (activeGames.has(interaction.channelId)) {
      await interaction.reply({ content: '⚠️ يوجد لعبة نشطة هنا!', ephemeral: true });
      return;
    }

    const word = words[Math.floor(Math.random() * words.length)];
    const game = { word, guessed: new Set<string>(), wrong: 0 };
    activeGames.set(interaction.channelId, game);

    const getDisplay = () => word.split('').map(c => game.guessed.has(c) ? c : '\_').join(' ');
    const getHangman = (w: number) => ['😊', '😐', '😟', '😨', '😰', '😱', '💀'][w];

    await interaction.reply({
      embeds: [new EmbedBuilder()
        .setColor(0x3498db)
        .setTitle('🔤 تخمين الكلمة!')
        .setDescription(`الكلمة: **${getDisplay()}**\n\n${getHangman(0)} المحاولات المتبقية: **6**\n\nأرسل حرفاً للتخمين!`)
        .setTimestamp()]
    });

    const filter = (m: any) => !m.author.bot && m.content.length === 1;
    const collector = interaction.channel?.createMessageCollector({ filter, time: 60000 });

    collector?.on('collect', async (msg) => {
      const letter = msg.content.trim();

      if (game.guessed.has(letter)) {
        await msg.react('⚠️');
        return;
      }

      game.guessed.add(letter);

      if (!word.includes(letter)) {
        game.wrong++;
        await msg.react('❌');
      } else {
        await msg.react('✅');
      }

      const display = getDisplay();
      const won = !display.includes('\_');

      if (won) {
        collector?.stop();
        activeGames.delete(interaction.channelId);
        await interaction.followUp({
          embeds: [new EmbedBuilder()
            .setColor(0x2ecc71)
            .setTitle('🎉 صح!')
            .setDescription(`${msg.author} خمن الكلمة!\nالكلمة: **${word}**`)
            .setTimestamp()]
        });
        return;
      }

      if (game.wrong >= 6) {
        collector?.stop();
        activeGames.delete(interaction.channelId);
        await interaction.followUp({
          embeds: [new EmbedBuilder()
            .setColor(0xe74c3c)
            .setTitle('💀 خسرتم!')
            .setDescription(`انتهت المحاولات!\nالكلمة كانت: **${word}**`)
            .setTimestamp()]
        });
        return;
      }

      await interaction.followUp({
        embeds: [new EmbedBuilder()
          .setColor(0x3498db)
          .setTitle('🔤 تخمين الكلمة')
          .setDescription(`الكلمة: **${display}**\n\n${getHangman(game.wrong)} المحاولات المتبقية: **${6 - game.wrong}**\nالحروف المجربة: ${[...game.guessed].join(', ')}`)
          .setTimestamp()]
      });
    });

    collector?.on('end', (_, reason) => {
      if (reason === 'time') {
        activeGames.delete(interaction.channelId);
        interaction.followUp({
          embeds: [new EmbedBuilder().setColor(0xe74c3c).setTitle('⏰ انتهى الوقت!').setDescription(`الكلمة كانت: **${word}**`).setTimestamp()]
        });
      }
    });
  }
};

export default command;
