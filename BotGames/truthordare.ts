import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { Command } from '../../types';

const truths = [
  'ما أكثر شيء تخجل منه في حياتك؟',
  'ما أغرب شيء فعلته في حياتك؟',
  'هل سبق وكذبت على صديق مقرب؟',
  'ما أكثر شيء تتمنى تغييره في نفسك؟',
  'ما آخر شيء بحثت عنه في الإنترنت؟',
  'هل عندك سر تخبئه عن عائلتك؟',
  'ما أسوأ قرار اتخذته في حياتك؟',
  'من أكثر شخص تحبه في هذا السيرفر؟',
  'هل سبق وشاهدت فيلم لمن هو أكبر منك عمراً؟',
  'ما أكثر شيء تندم على قوله لشخص ما؟',
];

const dares = [
  'أرسل أول صورة في معرض صورك!',
  'اكتب رسالة محرجة لآخر شخص كلمته!',
  'غير اسمك في السيرفر لـ "أنا خسرت" لمدة ساعة!',
  'أرسل صوتية تقول فيها "أنا الأفضل في السيرفر"!',
  'منشن عشوائي لثلاثة أشخاص وقل لهم "أنتم أصدقائي المفضلين"!',
  'اكتب قصيدة من 4 أسطر الآن!',
  'اكتب اسمك بالإنجليزي بشكل معكوس!',
  'أرسل إيموجي واحد يصف مزاجك الآن وفسره!',
  'احكِ نكتة الآن!',
  'صف نفسك بـ 3 كلمات فقط!',
];

const command: Command = {
  cooldown: 5,
  data: new SlashCommandBuilder()
    .setName('truthordare')
    .setDescription('صراحة أو تحدي!')
    .addUserOption(opt => opt.setName('player').setDescription('اللاعب').setRequired(true))
    .addStringOption(opt =>
      opt.setName('choice')
        .setDescription('صراحة أو تحدي؟')
        .setRequired(true)
        .addChoices(
          { name: '🗣️ صراحة', value: 'truth' },
          { name: '💪 تحدي', value: 'dare' }
        )
    ) as SlashCommandBuilder,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const player = interaction.options.getUser('player', true);
    const choice = interaction.options.getString('choice', true);

    const isTruth = choice === 'truth';
    const list = isTruth ? truths : dares;
    const item = list[Math.floor(Math.random() * list.length)];

    await interaction.reply({
      embeds: [new EmbedBuilder()
        .setColor(isTruth ? 0x3498db : 0xe74c3c)
        .setTitle(isTruth ? '🗣️ صراحة!' : '💪 تحدي!')
        .setDescription(`${player} عليك ${isTruth ? 'الإجابة على' : 'تنفيذ'}:\n\n**${item}**`)
        .setFooter({ text: `طلب من: ${interaction.user.username}` })
        .setTimestamp()]
    });
  }
};

export default command;
