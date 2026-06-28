// ══════════════════════════════════════════════════════════════
//  Opus System Bot V2 — Embed Utilities
//  Premium dark theme with Application Emoji branding
// ══════════════════════════════════════════════════════════════

import { EmbedBuilder, ColorResolvable } from "discord.js";
import { Config } from "../config";
import { Emojis } from "./emojis";

/** V2 Premium Color Palette */
export const Colors = {
  primary: Config.embed.color as ColorResolvable,
  success: 0x2dce89 as ColorResolvable,
  warning: 0xfb6340 as ColorResolvable,
  error: 0xf5365c as ColorResolvable,
  info: 0x11cdef as ColorResolvable,
  moderation: 0xff6b35 as ColorResolvable,
  ticket: 0x8965e0 as ColorResolvable,
  welcome: 0x2dce89 as ColorResolvable,
  leave: 0xf5365c as ColorResolvable,
  filter: 0xe74c3c as ColorResolvable,
  economy: 0xffd600 as ColorResolvable,
  level: 0x5e72e4 as ColorResolvable,
};

/**
 * Creates a pre-styled V2 embed with bot branding.
 */
export function createEmbed(
  title: string,
  description: string,
  color: ColorResolvable = Colors.primary,
): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle(title)
    .setDescription(description)
    .setColor(color)
    .setFooter({ text: Config.embed.footer ?? "Opus System Bot" })
    .setTimestamp();
}

/** Quick success embed */
export function successEmbed(title: string, desc: string) {
  return createEmbed(`${Emojis.success}  ${title}`, desc, Colors.success);
}

/** Quick error embed */
export function errorEmbed(title: string, desc: string) {
  return createEmbed(`${Emojis.error}  ${title}`, desc, Colors.error);
}

/** Quick warning embed */
export function warningEmbed(title: string, desc: string) {
  return createEmbed(`${Emojis.warning}  ${title}`, desc, Colors.warning);
}

/** Quick info embed */
export function infoEmbed(title: string, desc: string) {
  return createEmbed(`${Emojis.info}  ${title}`, desc, Colors.info);
}

/** Quick moderation embed */
export function modEmbed(title: string, desc: string) {
  return createEmbed(`${Emojis.ban}  ${title}`, desc, Colors.moderation);
}

/** Filter / Auto-mod embed */
export function filterEmbed(title: string, desc: string) {
  return createEmbed(`${Emojis.filter}  ${title}`, desc, Colors.filter);
}

/** Economy embed */
export function economyEmbed(title: string, desc: string) {
  return createEmbed(`${Emojis.credits}  ${title}`, desc, Colors.economy);
}

/** Level embed */
export function levelEmbed(title: string, desc: string) {
  return createEmbed(`${Emojis.xp}  ${title}`, desc, Colors.level);
}
