export const runtime = 'nodejs';

import { NextRequest } from 'next/server';
import { fail, internalError, ok } from '@/lib/api-response';
import { rateLimit } from '@/lib/rate-limit';
import { getSession } from '@/lib/sessions';
import { assertOwnedBot } from '@/lib/dashboard-data';
import { supabaseAdmin } from '@/lib/supabase';
import { decryptBotToken } from '@/lib/encryption';
import { fetchBotGuildTextChannels } from '@/lib/discord';

/** Resolve the decrypted token for this bot instance without exposing it to the browser. */
async function tokenForInstance(botId: string): Promise<string | null> {
  const supabase = supabaseAdmin();
  const { data: inst } = await supabase.from('bot_instances').select('token_id').eq('id', botId).maybeSingle();
  if (!inst?.token_id) return null;
  const { data: tok } = await supabase.from('token_pool').select('bot_token_encrypted').eq('id', inst.token_id).maybeSingle();
  if (!tok?.bot_token_encrypted) return null;
  try {
    return decryptBotToken(tok.bot_token_encrypted);
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const session = await getSession();
    if (!session) return fail('unauthorized', 'سجّل دخولك أولاً.', 401);
    if (!rateLimit(req, 'bot:channels', 30, 60_000).allowed) return fail('rate_limited', 'محاولات كثيرة. انتظر دقيقة.', 429);

    const bot = await assertOwnedBot(session.discordUserId, id);
    if (!bot) return fail('forbidden', 'Access denied', 403);
    if (bot.product_type !== 'general') return fail('bad_request', 'اختيار روم الترحيب خاص ببوت السيستم فقط.', 400);

    const token = await tokenForInstance(id);
    if (!token) return fail('conflict', 'البوت غير مرتبط بتوكن بعد. انتظر تفعيله ثم أعد المحاولة.', 409);

    const channels = await fetchBotGuildTextChannels(token, bot.guild_id);
    if (!channels) {
      return fail('conflict', 'ما قدرنا نقرأ رومات السيرفر. تأكد أن البوت داخل السيرفر ومعه صلاحية View Channels.', 409);
    }

    return ok({ channels });
  } catch (error) {
    console.error('[dashboard/bot/channels][GET]', error);
    return internalError();
  }
}
