import type { APIMessageComponentEmoji, Guild } from 'discord.js';

export function componentEmojiFromId(emojiId: string | undefined): APIMessageComponentEmoji | undefined {
  const normalized = emojiId?.trim();

  if (!normalized) {
    return undefined;
  }

  return {
    id: normalized,
    name: 'icon',
  };
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
