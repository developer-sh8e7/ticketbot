import { supabase } from "./supabase.js";
import { Logger } from "../utils/logger.js";
import { getUserData } from "./users.js";

export interface MemberData {
  guild_id: string;
  user_id: string;
  xp: number;
  level: number;
  warnings: number;
}

const cache = new Map<string, MemberData>();

function getCacheKey(guildId: string, userId: string) {
  return `${guildId}-${userId}`;
}

export async function getMemberData(guildId: string, userId: string): Promise<MemberData | null> {
  const key = getCacheKey(guildId, userId);
  if (cache.has(key)) return cache.get(key)!;

  try {
    const { data, error } = await supabase
      .from("members")
      .select("*")
      .eq("guild_id", guildId)
      .eq("user_id", userId)
      .single();

    if (error && error.code === "PGRST116") {
      // Ensure the user exists in the global users table first (Foreign Key constraint)
      await getUserData(userId);

      const newMember = {
        guild_id: guildId,
        user_id: userId,
        xp: 0,
        level: 1,
        warnings: 0,
      };
      const { data: createdData, error: createError } = await supabase
        .from("members")
        .insert(newMember)
        .select()
        .single();

      if (createError) {
        if (createError.code === "23505") { // unique_violation
          const { data: existingData, error: existingError } = await supabase
            .from("members")
            .select("*")
            .eq("guild_id", guildId)
            .eq("user_id", userId)
            .single();
          if (existingError) throw existingError;
          cache.set(key, existingData);
          return existingData;
        }
        throw createError;
      }
      
      cache.set(key, createdData);
      return createdData;
    }

    if (error) throw error;

    cache.set(key, data);
    return data;
  } catch (err: any) {
    Logger.error(`Failed to fetch member data for ${userId} in ${guildId}: ${err?.message || JSON.stringify(err)}`);
    return null;
  }
}

export async function updateMemberData(guildId: string, userId: string, updates: Partial<MemberData>) {
  try {
    const { error } = await supabase
      .from("members")
      .update(updates)
      .eq("guild_id", guildId)
      .eq("user_id", userId);

    if (error) throw error;
    cache.delete(getCacheKey(guildId, userId));
    return true;
  } catch (err) {
    Logger.error(`Failed to update member data for ${userId} in ${guildId}: ${err}`);
    return false;
  }
}
