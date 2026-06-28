// ══════════════════════════════════════════════════════════════
//  Event — messageDelete & messageUpdate (Message Logs)
//  V2 — Application Emojis, no Unicode emojis
// ══════════════════════════════════════════════════════════════

import { Client, Message, PartialMessage, EmbedBuilder } from "discord.js";
import { Colors } from "../utils/embed.js";
import { Emojis } from "../utils/emojis.js";
import { Config } from "../config.js";
import { getGuildConfig } from "../db/guilds.js";

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
      .setTitle(`${Emojis.delete}  Message Deleted`)
      .setDescription(
        [
          `**Author:** ${message.author?.tag ?? "Unknown"} (\`${message.author?.id ?? "?"}\`)`,
          `**Channel:** ${message.channel}`,
          `**Content:**\n\`\`\`${(message.content ?? "No content").slice(0, 1000)}\`\`\``,
        ].join("\n"),
      )
      .setColor(Colors.error)
      .setFooter({ text: Config.embed.footer })
      .setTimestamp();

    if (message.attachments.size > 0) {
      embed.addFields({
        name: `${Emojis.link} Attachments`,
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
      .setTitle(`${Emojis.edit}  Message Edited`)
      .setDescription(
        [
          `**Author:** ${oldMessage.author?.tag ?? "Unknown"} (\`${oldMessage.author?.id ?? "?"}\`)`,
          `**Channel:** ${oldMessage.channel}`,
          `**[Jump to Message](${newMessage.url})**`,
        ].join("\n"),
      )
      .addFields(
        {
          name: "Before",
          value: `\`\`\`${(oldMessage.content ?? "No content").slice(0, 500)}\`\`\``,
        },
        {
          name: "After",
          value: `\`\`\`${(newMessage.content ?? "No content").slice(0, 500)}\`\`\``,
        },
      )
      .setColor(Colors.warning)
      .setFooter({ text: Config.embed.footer })
      .setTimestamp();

    await logChannel.send({ embeds: [embed] });
  },
};
