import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  EmbedBuilder,
  MessageFlags,
  PermissionFlagsBits,
  type ButtonInteraction,
} from 'discord.js';
import type { MediatorRepository } from '../database/mediatorRepository.js';
import type { Env } from '../env.js';
import type { ConfigStore } from '../services/configStore.js';
import { hexToDecimal } from '../utils/color.js';
import { normalizeChannelName } from '../utils/text.js';

export class MediatorApplicationHandler {
  public constructor(
    private readonly mediatorRepository: MediatorRepository,
    private readonly configStore: ConfigStore,
    private readonly env: Env,
  ) {}

  public async handle(interaction: ButtonInteraction): Promise<void> {
    if (!interaction.inCachedGuild()) {
      await interaction.reply({
        flags: MessageFlags.Ephemeral,
        embeds: [
          new EmbedBuilder()
            .setColor(0xed4245)
            .setTitle('تعذر تنفيذ الطلب')
            .setDescription('هذا الزر يعمل داخل السيرفر فقط.'),
        ],
      });
      return;
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const status = await this.mediatorRepository.checkVerificationStatus(interaction.user.id);
    if (!status?.isFullyVerified) {
      const websiteUrl = this.env.WEBSITE_URL || 'https://stb-arab.vercel.app/';
      const embed = new EmbedBuilder()
        .setColor(0xed4245)
        .setTitle('❌ غير مؤهل')
        .setDescription('يجب إكمال التحقق من رقم واتسابك عبر موقعنا.');

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setLabel('🔗 ابدأ التحقق')
          .setStyle(ButtonStyle.Link)
          .setURL(websiteUrl),
      );

      await interaction.editReply({ embeds: [embed], components: [row] });
      return;
    }

    const config = this.configStore.current;
    const staffRoleId = this.env.STAFF_ROLE_ID;
    const staffRole = staffRoleId ? interaction.guild.roles.cache.get(staffRoleId) : null;
    const paddedTime = Date.now().toString().slice(-8);
    const channelName = normalizeChannelName(
      `mediator-${interaction.user.username}-${paddedTime}`,
      config.naming.maxChannelNameLength,
    );

    const channel = await interaction.guild.channels.create({
      name: channelName,
      type: ChannelType.GuildText,
      parent: config.guild.categoryId,
      permissionOverwrites: [
        {
          id: interaction.guild.roles.everyone.id,
          deny: [PermissionFlagsBits.ViewChannel],
        },
        {
          id: interaction.user.id,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ReadMessageHistory,
            PermissionFlagsBits.AttachFiles,
            PermissionFlagsBits.EmbedLinks,
          ],
        },
        ...(staffRole
          ? [
              {
                id: staffRole.id,
                allow: [
                  PermissionFlagsBits.ViewChannel,
                  PermissionFlagsBits.SendMessages,
                  PermissionFlagsBits.ReadMessageHistory,
                  PermissionFlagsBits.AttachFiles,
                  PermissionFlagsBits.EmbedLinks,
                  PermissionFlagsBits.ManageMessages,
                ],
              },
            ]
          : []),
        ...(interaction.guild.members.me
          ? [
              {
                id: interaction.guild.members.me.id,
                allow: [
                  PermissionFlagsBits.ViewChannel,
                  PermissionFlagsBits.SendMessages,
                  PermissionFlagsBits.ReadMessageHistory,
                  PermissionFlagsBits.AttachFiles,
                  PermissionFlagsBits.EmbedLinks,
                  PermissionFlagsBits.ManageChannels,
                  PermissionFlagsBits.ManageMessages,
                ],
              },
            ]
          : []),
      ],
    });

    const embed = new EmbedBuilder()
      .setColor(0x57f287)
      .setTitle('🛡️ طلب وسيط جديد')
      .addFields(
        { name: 'المتقدم', value: `<@${interaction.user.id}>`, inline: true },
        {
          name: 'تاريخ التحقق',
          value: status.verifiedAt ? `<t:${Math.floor(new Date(status.verifiedAt).getTime() / 1000)}:F>` : 'محفوظ',
          inline: true,
        },
        { name: 'الجوال', value: 'محفوظ ومشفر ✅', inline: false },
      )
      .setFooter({ text: 'تم التحقق من الهوية عبر واتساب' })
      .setTimestamp();

    await channel.send({
      content: staffRole ? `<@${interaction.user.id}> <@&${staffRole.id}>` : `<@${interaction.user.id}>`,
      embeds: [embed],
      allowedMentions: {
        users: [interaction.user.id],
        roles: staffRole ? [staffRole.id] : [],
      },
    });

    await interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setColor(hexToDecimal(config.bot.successColor))
          .setTitle('تم فتح طلب التقديم')
          .setDescription(`تم فتح قناة خاصة لك: <#${channel.id}>`),
      ],
    });
  }
}
