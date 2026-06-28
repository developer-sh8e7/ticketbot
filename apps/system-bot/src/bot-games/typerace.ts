import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { Command } from '../../types';

const sentences = [
  'السرعة في الكتابة تحتاج إلى تدريب يومي مستمر',
  'ديسكورد منصة رائعة للتواصل مع الأصدقاء',
  'البرمجة مهارة المستقبل وأساس التكنولوجيا الحديثة',
  'الصبر مفتاح النجاح في كل مجالات الحياة',
  'تعلم شيء جديد كل يوم يجعلك أذكى وأفضل',
  'الكود الجيد يحتاج إلى تفكير قبل الكتابة',
  'من جد وجد ومن زرع حصد',
];

const activeRaces = new Map<string, boolean>();

const command: Command = {
  cooldown: 15,
  data: new SlashCommandBuilder()
    .setName('typerace')
    .setDescription('سباق الكتابة — من يكتب الجملة أسرع يفوز!') as SlashCommandBuilder,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    if (activeRaces.get(interaction.channelId)) {
      await interaction.reply({ content: '⚠️ يوجد سباق نشط في هذه القناة!', ephemeral: true });
      return;
    }

    const sentence = sentences[Math.floor(Math.random() * sentences.length)];
    activeRaces.set(interaction.channelId, true);

    await interaction.reply({
      embeds: [new EmbedBuilder()
        .setColor(0xe67e22)
        .setTitle('⌨️ سباق الكتابة!')
        .setDescription(`اكتب الجملة التالية بسرعة:\n\n\`\`\`${sentence}\`\`\``)
        .setFooter({ text: 'عندك 30 ثانية!' })
        .setTimestamp()]
    });

    const startTime = Date.now();
    const filter = (m: any) => !m.author.bot;
    const collector = interaction.channel?.createMessageCollector({ filter, time: 30000 });

    let won = false;
    collector?.on('collect', async (msg) => {
      if (msg.content === sentence) {
        won = true;
        collector.stop();
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
        const words = sentence.split(' ').length;
        const wpm = Math.round((words / parseFloat(elapsed)) * 60);

        await msg.reply({
          embeds: [new EmbedBuilder()
            .setColor(0x2ecc71)
            .setTitle('🏆 فاز بالسباق!')
            .setDescription(`${msg.author} فاز!\n\n⏱️ الوقت: **${elapsed}** ثانية\n🚀 السرعة: **${wpm} WPM**`)
            .setTimestamp()]
        });
      }
    });

    collector?.on('end', async () => {
      activeRaces.delete(interaction.channelId);
      if (!won) {
        await interaction.followUp({
          embeds: [new EmbedBuilder()
            .setColor(0xe74c3c)
            .setTitle('⏰ انتهى الوقت!')
            .setDescription('لم يفز أحد في السباق هذه المرة.')
            .setTimestamp()]
        });
      }
    });
  }
};

export default command;
