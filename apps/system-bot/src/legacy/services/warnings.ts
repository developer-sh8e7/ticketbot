import { supabase } from "../db/supabase.js";
import { Logger } from "../utils/logger.js";

export type WarningRecord = {
  id: string;
  guild_id: string;
  user_id: string;
  moderator_id: string;
  reason: string;
  created_at: string;
};

export async function addWarning(guildId: string, userId: string, moderatorId: string, reason: string): Promise<number | null> {
  try {
    const { error } = await supabase.from("guild_warnings").insert({
      guild_id: guildId,
      user_id: userId,
      moderator_id: moderatorId,
      reason,
    });
    if (error) throw error;

    const { count } = await supabase
      .from("guild_warnings")
      .select("id", { count: "exact", head: true })
      .eq("guild_id", guildId)
      .eq("user_id", userId);
    return count ?? null;
  } catch (err) {
    Logger.error(`Failed to store warning for guild ${guildId}: ${err}`);
    return null;
  }
}

export async function listWarnings(guildId: string, userId: string, limit = 10): Promise<WarningRecord[]> {
  const { data, error } = await supabase
    .from("guild_warnings")
    .select("id,guild_id,user_id,moderator_id,reason,created_at")
    .eq("guild_id", guildId)
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as WarningRecord[];
}

export async function clearWarnings(guildId: string, userId: string): Promise<number> {
  const existing = await listWarnings(guildId, userId, 1000);
  if (existing.length === 0) return 0;
  const { error } = await supabase.from("guild_warnings").delete().eq("guild_id", guildId).eq("user_id", userId);
  if (error) throw error;
  return existing.length;
}
