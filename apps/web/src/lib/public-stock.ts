import { supabaseAdmin } from './supabase';
import { PROVISIONABLE_TYPES } from './provisioning-shared';

/** Qualitative, public-safe stock status — never exposes exact inventory counts. */
export type StockStatus = 'in' | 'low' | 'out';

export type PublicStock = Record<string, StockStatus>;

function statusFor(count: number): StockStatus {
  if (count <= 0) return 'out';
  if (count <= 2) return 'low';
  return 'in';
}

/**
 * Resolve a public stock status for each provisionable product type. Used to
 * show "متوفر / كمية محدودة / نفد مؤقتاً" on the store without leaking numbers.
 * Best-effort: any error yields an empty map so the storefront still renders.
 */
export async function getPublicStock(): Promise<PublicStock> {
  const result: PublicStock = {};
  let supabase: ReturnType<typeof supabaseAdmin>;
  try {
    supabase = supabaseAdmin();
  } catch {
    // Env not available (e.g. build-time prerender) — render storefront without pills.
    return result;
  }
  await Promise.all(
    [...PROVISIONABLE_TYPES].map(async (productType) => {
      try {
        const { data, error } = await supabase.rpc('available_token_count', { p_product_type: productType });
        if (error) return;
        result[productType] = statusFor(Number(data) || 0);
      } catch {
        /* leave unset */
      }
    }),
  );
  return result;
}
