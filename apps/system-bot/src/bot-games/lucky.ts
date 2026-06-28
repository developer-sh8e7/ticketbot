import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { Command } from '../../types';

const activeGames = new Map<string, Map<string, number>>();

const command: Command = {
  cooldown: 5,
  data: new SlashCommandBuilder()
    .setName('lucky')
    .setDescription('الرقم المحظوظ — خمن رقم بين 1 و 100!')
    .addIntegerOption(opt =>
      opt.setName('number')
        .setDescription('رقمك بين 1 و 100')
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(100)
    ) as SlashCommandBuilder,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const num = interaction.options.getInteger('number', true);
    const channelId = interaction.channelId;

    if (!activeGames.has(channelId)) {
      activeGames.set(channelId, new Map());

      setTimeout(async () => {
        const players = activeGames.get(channelId);
        if (!players || players.size === 0) {
          activeGames.delete(channelId);
          return;
        }

        const winning = Math.floor(Math.random() * 100) + 1;
        let closest = '';
        let closestDiff = 101;

        players.forEach((n, userId) => {
          const diff = Math.abs(n - winning);
          if (diff < closestDiff) {
            closestDiff = diff;
            closest = userId;
          }
        });

        activeGames.delete(channelId);

        const results = [...players.entries()].map(([id, n]) => `<@${id}>: **${n}** (فرق: ${Math.abs(n - winning)})`).join('\n');

        await interaction.channel?.send({
          embeds: [new EmbedBuilder()
            .setColor(0xf1c40f)
            .setTitle('🎰 نتيجة الرقم المحظوظ!')
            .setDescription(`الرقم الفائز: **${winning}**\n\n📊 النتائج:\n${results}\n\n🏆 الفائز: <@${closest}>`)
            .setTimestamp()]
        });
      }, 30000);

      await interaction.reply({
        embeds: [new EmbedBuilder()
          .setColor(0x9b59b6)
          .setTitle('🎰 لعبة الرقم المحظوظ بدأت!')
          .setDescription(`${interaction.user} سجل رقم **${num}**\n\nعندكم 30 ثانية للمشاركة!\nاستخدم \`/lucky\` واختر رقمك!`)
          .setTimestamp()]
      });
    } else {
      const players = activeGames.get(channelId)!;
      players.set(interaction.user.id, num);

      await interaction.reply({
        embeds: [new EmbedBuilder()
          .setColor(0x2ecc71)
          .setDescription(`✅ ${interaction.user} سجل رقم **${num}** — انتظر النتيجة!`)
          .setTimestamp()],
        ephemeral: true
      });
    }
  }
};

export default command;
