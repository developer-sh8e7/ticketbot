// ══════════════════════════════════════════════════════════════
//  Event — voiceStateUpdate (Voice Logs)
//  V2 — Application Emojis, no Unicode emojis
// ══════════════════════════════════════════════════════════════

import { Client, VoiceState, EmbedBuilder } from "discord.js";
import { Colors } from "../utils/embed";
import { Emojis } from "../utils/emojis";
import { Config } from "../config";
import { getGuildConfig } from "../db/guilds";

export default {
  name: "voiceStateUpdate" as const,
  once: false,
  async execute(_client: Client, oldState: VoiceState, newState: VoiceState) {
    if (oldState.member?.user.bot) return;

    const dbConfig = await getGuildConfig(newState.guild.id);
    if (!dbConfig.modules.logging_enabled || !dbConfig.channels.voice_logs_channel) return;

    const logChannel = newState.guild.channels.cache.get(dbConfig.channels.voice_logs_channel);
    if (!logChannel?.isTextBased()) return;

    const embed = new EmbedBuilder()
      .setAuthor({
        name: newState.member?.user.tag ?? "Unknown",
        iconURL: newState.member?.user.displayAvatarURL(),
      })
      .setFooter({ text: Config.embed.footer })
      .setTimestamp();

    // Join
    if (!oldState.channelId && newState.channelId) {
      embed
        .setTitle(`${Emojis.voice}  Voice Join`)
        .setDescription(`Joined ${newState.channel}`)
        .setColor(Colors.success);
    }
    // Leave
    else if (oldState.channelId && !newState.channelId) {
      embed
        .setTitle(`${Emojis.voice}  Voice Leave`)
        .setDescription(`Left ${oldState.channel}`)
        .setColor(Colors.error);
    }
    // Move
    else if (oldState.channelId !== newState.channelId) {
      embed
        .setTitle(`${Emojis.voice}  Voice Move`)
        .setDescription(`Moved from ${oldState.channel} to ${newState.channel}`)
        .setColor(Colors.warning);
    } else {
      // Stream, mute, deafen updates
      return;
    }

    await logChannel.send({ embeds: [embed] });
  },
};
