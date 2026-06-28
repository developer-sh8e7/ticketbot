import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { Command } from '../../types';
import { gameEmbed } from '../../utils/embed';

const triviaQuestions = [
  { q: 'ما عاصمة فرنسا؟', a: 'باريس', options: ['لندن', 'برلين', 'باريس', 'روما'] },
  { q: 'كم عدد كواكب المجموعة الشمسية؟', a: '8', options: ['7', '8', '9', '10'] },
  { q: 'من اخترع الهاتف؟', a: 'غراهام بيل', options: ['إديسون', 'غراهام بيل', 'نيوتن', 'تيسلا'] },
  { q: 'ما أكبر محيطات العالم؟', a: 'المحيط الهادئ', options: ['الأطلسي', 'الهندي', 'المحيط الهادئ', 'المتجمد'] },
  { q: 'كم عدد أيام السنة الكبيسة؟', a: '366', options: ['364', '365', '366', '367'] },
  { q: 'ما أسرع حيوان بري؟', a: 'الفهد', options: ['الأسد', 'الفهد', 'النمر', 'الحصان'] },
  { q: 'في أي بلد بُنيت الأهرامات؟', a: 'مصر', options: ['العراق', 'السودان', 'مصر', 'المغرب'] },
  { q: 'ما أكبر دولة في العالم مساحةً؟', a: 'روسيا', options: ['الصين', 'كندا', 'روسيا', 'أمريكا'] },
  { q: 'كم عدد لاعبي كرة القدم في الفريق الواحد؟', a: '11', options: ['9', '10', '11', '12'] },
  { q: 'ما أطول نهر في العالم؟', a: 'النيل', options: ['الأمازون', 'النيل', 'المسيسيبي', 'الكونغو'] },
];

const activeGames = new Map<string, boolean>();

const command: Command = {
  cooldown: 10,
  data: new SlashCommandBuilder()
    .setName('trivia')
    .setDescription('أسئلة ثقافية — كن أول من يجيب صح!') as SlashCommandBuilder,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const channelId = interaction.channelId;
    if (activeGames.get(channelId)) {
      await interaction.reply({ content: '⚠️ يوجد سؤال نشط في هذه القناة!', ephemeral: true });
      return;
    }

    const q = triviaQuestions[Math.floor(Math.random() * triviaQuestions.length)];
    activeGames.set(channelId, true);

    const embed = new EmbedBuilder()
      .setColor(0x9b59b6)
      .setTitle('🧠 سؤال ثقافي!')
      .setDescription(`**${q.q}**\n\n${q.options.map((o, i) => `${['🅰️','🅱️','🆎','🅾️'][i]} ${o}`).join('\n')}`)
      .setFooter({ text: 'عندك 20 ثانية للإجابة!' })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });

    const filter = (m: any) => !m.author.bot;
    const collector = interaction.channel?.createMessageCollector({ filter, time: 20000 });

    let answered = false;
    collector?.on('collect', async (msg) => {
      if (msg.content.toLowerCase().includes(q.a.toLowerCase())) {
        answered = true;
        collector.stop();
        await msg.reply({
          embeds: [new EmbedBuilder()
            .setColor(0x2ecc71)
            .setTitle('🎉 إجابة صحيحة!')
            .setDescription(`${msg.author} أجاب صح!\n\nالإجابة: **${q.a}**`)
            .setTimestamp()]
        });
      }
    });

    collector?.on('end', async () => {
      activeGames.delete(channelId);
      if (!answered) {
        await interaction.followUp({
          embeds: [new EmbedBuilder()
            .setColor(0xe74c3c)
            .setTitle('⏰ انتهى الوقت!')
            .setDescription(`لم يجب أحد صح.\nالإجابة الصحيحة: **${q.a}**`)
            .setTimestamp()]
        });
      }
    });
  }
};

export default command;
