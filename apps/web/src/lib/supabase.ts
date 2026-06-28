import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env } from './env';

let adminClient: SupabaseClient | null = null;

export function supabaseAdmin(): SupabaseClient {
  if (!adminClient) {
    const e = env();
    adminClient = createClient(e.SUPABASE_URL, e.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { 'x-application-name': 'opus-ticket-website' } },
    });
  }
  return adminClient;
}
