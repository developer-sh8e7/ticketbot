export const STB_GUILD_ID = '1413059459630104626';
export const STORE_GUILD_ID = '1395842846107631746';
export const SEED_GUILD_IDS = new Set([STB_GUILD_ID, STORE_GUILD_ID]);

export function isSeedGuild(guildId: string | null | undefined): boolean {
  return Boolean(guildId && SEED_GUILD_IDS.has(guildId));
}

export function isStbGuild(guildId: string | null | undefined): boolean {
  return guildId === STB_GUILD_ID;
}

export function isStoreGuild(guildId: string | null | undefined): boolean {
  return guildId === STORE_GUILD_ID;
}
