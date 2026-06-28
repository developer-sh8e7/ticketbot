import { supabase } from "./supabase";
import { Logger } from "../utils/logger";

export interface UserData {
  id: string;
  username: string | null;
  credits: number;
  global_xp: number;
  last_daily: string | null;
  rep: number;
}

const cache = new Map<string, UserData>();

export async function getUserData(userId: string, username?: string): Promise<UserData | null> {
  if (cache.has(userId)) return cache.get(userId)!;

  try {
    const { data, error } = await supabase
      .from("users")
      .select("*")
      .eq("id", userId)
      .single();

    if (error && error.code === "PGRST116") {
      // User doesn't exist, create them
      const newUser: Partial<UserData> = {
        id: userId,
        username: username || null,
        credits: 0,
        global_xp: 0,
        rep: 0,
      };
      const { data: createdData, error: createError } = await supabase
        .from("users")
        .insert(newUser)
        .select()
        .single();

      if (createError) {
        if (createError.code === "23505") { // unique_violation
          const { data: existingData, error: existingError } = await supabase
            .from("users")
            .select("*")
            .eq("id", userId)
            .single();
          if (existingError) throw existingError;
          cache.set(userId, existingData);
          return existingData;
        }
        throw createError;
      }

      cache.set(userId, createdData);
      return createdData;
    }

    if (error) throw error;

    cache.set(userId, data);
    return data;
  } catch (err: any) {
    Logger.error(`Failed to fetch user data for ${userId}: ${err?.message || JSON.stringify(err)}`);
    return null;
  }
}

export async function updateUserData(userId: string, updates: Partial<UserData>) {
  try {
    const { error } = await supabase
      .from("users")
      .update(updates)
      .eq("id", userId);

    if (error) throw error;
    cache.delete(userId);
    return true;
  } catch (err) {
    Logger.error(`Failed to update user data for ${userId}: ${err}`);
    return false;
  }
}
