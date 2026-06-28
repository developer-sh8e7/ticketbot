import { z } from 'zod';
import { isSafeHttpsUrl, rejectHtml } from './security';

export const activationCodeSchema = z.string().trim().toUpperCase().regex(/^OPUS-[A-Z]+-[A-Z0-9]{4}-[A-Z0-9]{4}$/);
export const discordSnowflakeSchema = z.string().regex(/^\d{17,20}$/);
export const optionalDiscordSnowflakeSchema = z.union([discordSnowflakeSchema, z.literal(''), z.null()]).transform((v) => (v ? v : null));

export const safeText = (max: number) =>
  z.string().trim().max(max).refine(rejectHtml, 'HTML and control characters are not allowed');

export const safeOptionalHttpsUrl = z
  .union([z.string().trim().url(), z.literal(''), z.null(), z.undefined()])
  .transform((v) => (v ? String(v).trim() : null))
  .refine((v) => v === null || isSafeHttpsUrl(v), 'Only public https URLs are allowed');

export const botIdentitySchema = z.object({
  bot_name: safeText(80).optional(),
  bot_avatar: safeOptionalHttpsUrl.optional(),
  bot_description: safeText(400).optional(),
  status: z.never().optional(),
});

export const ticketSettingsSchema = z.object({
  panel_channel_id: optionalDiscordSnowflakeSchema,
  log_channel_id: optionalDiscordSnowflakeSchema,
  transcript_channel_id: optionalDiscordSnowflakeSchema,
  ticket_category_id: optionalDiscordSnowflakeSchema,
  archive_category_id: optionalDiscordSnowflakeSchema,
  support_role_id: optionalDiscordSnowflakeSchema,
  panel_message: safeText(800),
  embed_color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  banner_url: safeOptionalHttpsUrl,
  button_text: safeText(80),
  footer_text: safeText(160),
});

export type TicketSettingsInput = z.infer<typeof ticketSettingsSchema>;
