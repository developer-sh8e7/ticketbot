// ══════════════════════════════════════════════════════════════
//  Event — messageDelete & messageUpdate (Message Logs)
//  V2 — Application Emojis, no Unicode emojis
// ══════════════════════════════════════════════════════════════

import { Client, Message, PartialMessage, EmbedBuilder } from "discord.js";
import { Colors } from "../utils/embed";
import { Emojis } from "../utils/emojis";
import { Config } from "../config";
import { getGuildConfig } from "../db/guilds";

export const messageDeleteEvent = {
  name: "messageDelete" as const,
  once: false,
  async execute(_client: Client, message: Message | PartialMessage) {
    if (message.author?.bot || !message.guild) return;

    const dbConfig = await getGuildConfig(message.guild.id);
    if (!dbConfig.modules.logging_enabled || !dbConfig.channels.message_logs_channel) return;

    const logChannel = message.guild.channels.cache.get(dbConfig.channels.message_logs_channel);
    if (!logChannel?.isTextBased() || !("send" in logChannel)) return;

    const embed = new EmbedBuilder()
      .setTitle(`${Emojis.delete}  حذف رسالة`)
      .setDescription(
        [
          `**الكاتب:** ${message.author?.tag ?? "غير معروف"} (\`${message.author?.id ?? "?"}\`)`,
          `**الروم:** ${message.channel}`,
          `**المحتوى:**\n\`\`\`${(message.content ?? "لا يوجد محتوى").slice(0, 1000)}\`\`\``,
        ].join("\n"),
      )
      .setColor(Colors.error)
      .setFooter({ text: Config.embed.footer })
      .setTimestamp();

    if (message.attachments.size > 0) {
      embed.addFields({
        name: `${Emojis.link} المرفقات`,
        value: message.attachments.map((a) => a.url).join("\n"),
      });
    }

    await logChannel.send({ embeds: [embed] });
  },
};

export const messageUpdateEvent = {
  name: "messageUpdate" as const,
  once: false,
  async execute(_client: Client, oldMessage: Message | PartialMessage, newMessage: Message | PartialMessage) {
    if (oldMessage.author?.bot || !oldMessage.guild) return;
    if (oldMessage.content === newMessage.content) return;

    const dbConfig = await getGuildConfig(oldMessage.guild.id);
    if (!dbConfig.modules.logging_enabled || !dbConfig.channels.message_logs_channel) return;

    const logChannel = oldMessage.guild.channels.cache.get(dbConfig.channels.message_logs_channel);
    if (!logChannel?.isTextBased() || !("send" in logChannel)) return;

    const embed = new EmbedBuilder()
      .setTitle(`${Emojis.edit}  تعديل رسالة`)
      .setDescription(
        [
          `**الكاتب:** ${oldMessage.author?.tag ?? "غير معروف"} (\`${oldMessage.author?.id ?? "?"}\`)`,
          `**الروم:** ${oldMessage.channel}`,
          `**[الانتقال إلى الرسالة](${newMessage.url})**`,
        ].join("\n"),
      )
      .addFields(
        {
          name: "قبل التعديل",
          value: `\`\`\`${(oldMessage.content ?? "لا يوجد محتوى").slice(0, 500)}\`\`\``,
        },
        {
          name: "بعد التعديل",
          value: `\`\`\`${(newMessage.content ?? "لا يوجد محتوى").slice(0, 500)}\`\`\``,
        },
      )
      .setColor(Colors.warning)
      .setFooter({ text: Config.embed.footer })
      .setTimestamp();

    await logChannel.send({ embeds: [embed] });
  },
};
