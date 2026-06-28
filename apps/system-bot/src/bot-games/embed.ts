import { EmbedBuilder } from 'discord.js';

export function successEmbed(title: string, description: string): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(0x2ecc71)
    .setTitle(`✅ ${title}`)
    .setDescription(description)
    .setTimestamp();
}

export function errorEmbed(description: string): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(0xe74c3c)
    .setTitle('❌ خطأ')
    .setDescription(description)
    .setTimestamp();
}

export function infoEmbed(title: string, description: string): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(0x3498db)
    .setTitle(title)
    .setDescription(description)
    .setTimestamp();
}

export function gameEmbed(title: string, description: string, color = 0x9b59b6): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(color)
    .setTitle(title)
    .setDescription(description)
    .setTimestamp();
}
