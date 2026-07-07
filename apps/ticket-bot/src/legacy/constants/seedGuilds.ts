export const SEED_GUILD_IDS = new Set(['1413059459630104626', '1395842846107631746']);

export function isSeedGuild(guildId: string | null | undefined): boolean {
  return Boolean(guildId && SEED_GUILD_IDS.has(guildId));
}
