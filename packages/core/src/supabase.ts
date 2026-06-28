import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export interface SupabaseConfig {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
}

/**
 * عميل Supabase بصلاحية الخادم (Service Role).
 * لا تستخدمه أبداً في كود يصل للمتصفح — هذا المفتاح يتجاوز كل سياسات RLS.
 */
export function createSupabaseClient(env: SupabaseConfig): SupabaseClient {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export type { SupabaseClient };
