import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { Command } from '../../types';

const activeGames = new Map<string, { lastWord: string; usedWords: Set<string>; lastPlayer: string }>();

const command: Command = {
  cooldown: 10,
  data: new SlashCommandBuilder()
    .setName('wordchain')
    .setDescription('سلسلة الكلمات — كل كلمة تبدأ بآخر حرف من الكلمة السابقة!') as SlashCommandBuilder,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    if (activeGames.has(interaction.channelId)) {
      await interaction.reply({ content: '⚠️ يوجد لعبة نشطة هنا!', ephemeral: true });
      return;
    }

    const startWord = 'ديسكورد';
    activeGames.set(interaction.channelId, {
      lastWord: startWord,
      usedWords: new Set([startWord]),
      lastPlayer: interaction.user.id,
    });

    await interaction.reply({
      embeds: [new EmbedBuilder()
        .setColor(0x1abc9c)
        .setTitle('🔗 سلسلة الكلمات!')
        .setDescription(`الكلمة الأولى: **${startWord}**\n\nالكلمة التالية يجب أن تبدأ بحرف: **${startWord[startWord.length - 1]}**\n\nأرسل كلمتك في القناة! عندك 20 ثانية لكل كلمة.`)
        .setTimestamp()]
    });

    const game = activeGames.get(interaction.channelId)!;

    const runCollector = () => {
      const filter = (m: any) => !m.author.bot && m.author.id !== game.lastPlayer;
      const collector = interaction.channel?.createMessageCollector({ filter, time: 20000, max: 1 });

      collector?.on('collect', async (msg) => {
        const word = msg.content.trim();
        const lastChar = game.lastWord[game.lastWord.length - 1];

        if (!word.startsWith(lastChar)) {
          await msg.reply({
            embeds: [new EmbedBuilder().setColor(0xe74c3c).setTitle('❌ خطأ!').setDescription(`الكلمة يجب أن تبدأ بحرف **${lastChar}**!\n${msg.author} خارج من اللعبة!`).setTimestamp()]
          });
          activeGames.delete(interaction.channelId);
          return;
        }

        if (game.usedWords.has(word)) {
          await msg.reply({
            embeds: [new EmbedBuilder().setColor(0xe74c3c).setTitle('❌ كلمة مكررة!').setDescription(`"${word}" استخدمت من قبل!\n${msg.author} خارج!`).setTimestamp()]
          });
          activeGames.delete(interaction.channelId);
          return;
        }

        game.lastWord = word;
        game.usedWords.add(word);
        game.lastPlayer = msg.author.id;

        await msg.react('✅');
        runCollector();
      });

      collector?.on('end', async (_, reason) => {
        if (reason === 'time') {
          activeGames.delete(interaction.channelId);
          await interaction.followUp({
            embeds: [new EmbedBuilder().setColor(0xe74c3c).setTitle('⏰ انتهت اللعبة!').setDescription(`انتهى الوقت! اللعبة كانت ممتعة — عدد الكلمات: **${game.usedWords.size}**`).setTimestamp()]
          });
        }
      });
    };

    runCollector();
  }
};

export default command;
