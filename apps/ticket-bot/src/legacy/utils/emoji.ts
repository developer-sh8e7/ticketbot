import type { APIMessageComponentEmoji, Guild } from 'discord.js';

export function componentEmojiFromId(emojiId: string | undefined): APIMessageComponentEmoji | undefined {
  const normalized = emojiId?.trim();

  if (!normalized) {
    return undefined;
  }

  // Custom emoji IDs are snowflakes; anything else is treated as a unicode emoji.
  if (/^\d{17,20}$/.test(normalized)) {
    return { id: normalized };
  }

  return { name: normalized };
}

export async function resolveEmojiMention(guild: Guild, emojiId: string | undefined): Promise<string> {
  const normalized = emojiId?.trim();

  if (!normalized) {
    return '';
  }

  const cached = guild.emojis.cache.get(normalized);
  if (cached) {
    return cached.toString();
  }

  try {
    const fetched = await guild.emojis.fetch(normalized);
    return fetched?.toString() ?? '';
  } catch {
    return '';
  }
}
