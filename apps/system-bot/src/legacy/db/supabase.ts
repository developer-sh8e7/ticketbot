// ══════════════════════════════════════════════════════════════
//  Supabase Client Setup
// ══════════════════════════════════════════════════════════════

import { createClient } from "@supabase/supabase-js";
import { Config } from "../config";

// Create a single supabase client for interacting with your database
export const supabase = createClient(Config.supabaseUrl, Config.supabaseKey, {
  auth: {
    persistSession: false,
  },
});
