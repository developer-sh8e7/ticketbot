/**
 * Build the Discord bot invite (OAuth2 authorize) URL for a provisioned bot.
 *
 * The customer never sees the bot token — only this link, which uses the public
 * application id. Clicking it and authorizing is the ONLY way a bot can enter a
 * guild (Discord requires a human with Manage Server to approve). We pre-fill
 * the guild so the customer's chosen server is already selected.
 *
 * Administrator permission keeps every product working without per-feature
 * permission gaps; tighten per product later if needed.
 */
const ADMINISTRATOR = '8';

export function botInviteUrl(applicationId: string, guildId?: string | null): string {
  const url = new URL('https://discord.com/oauth2/authorize');
  url.searchParams.set('client_id', applicationId);
  url.searchParams.set('scope', 'bot applications.commands');
  url.searchParams.set('permissions', ADMINISTRATOR);
  if (guildId) url.searchParams.set('guild_id', guildId);
  return url.toString();
}
