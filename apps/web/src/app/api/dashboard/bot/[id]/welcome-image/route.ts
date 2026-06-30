export const runtime = 'nodejs';

import { NextRequest } from 'next/server';
import { fail, internalError, ok } from '@/lib/api-response';
import { verifyCsrf } from '@/lib/csrf';
import { rateLimit } from '@/lib/rate-limit';
import { getSession } from '@/lib/sessions';
import { assertOwnedBot } from '@/lib/dashboard-data';
import { isOwnerId } from '@/lib/owner';
import { supabaseAdmin } from '@/lib/supabase';
import { logWebsiteEvent } from '@/lib/events';

const BUCKET = 'welcome-images';
const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);

type ImageConfig = {
  backgroundUrl: string;
  avatar: { xPct: number; yPct: number; radiusPct: number };
  text: { xPct: number; yPct: number; fontSizePct: number; color: string };
};

const DEFAULT_CONFIG: Omit<ImageConfig, 'backgroundUrl'> = {
  avatar: { xPct: 0.5, yPct: 0.5, radiusPct: 0.18 },
  text: { xPct: 0.5, yPct: 0.85, fontSizePct: 0.06, color: '#ffffff' },
};

function clamp01(n: number, fallback: number) {
  if (!Number.isFinite(n)) return fallback;
  return Math.min(1, Math.max(0, n));
}

/** صورة الترحيب خاصة ببوت السيستم فقط (نفس قيد ميزة الترحيب). */
async function ownedSystemBot(discordUserId: string, botId: string) {
  const bot = await assertOwnedBot(discordUserId, botId);
  if (!bot) return { error: fail('forbidden', 'Access denied', 403) };
  if (bot.product_type !== 'general') return { error: fail('bad_request', 'صورة الترحيب خاصة ببوت السيستم فقط.', 400) };
  return { bot };
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const session = await getSession();
    if (!session) return fail('unauthorized', 'Login required', 401);
    const r = await ownedSystemBot(session.discordUserId, id);
    if ('error' in r) return r.error;

    const { data } = await supabaseAdmin().from('guild_welcome').select('image_enabled,image_config').eq('guild_id', r.bot.guild_id).maybeSingle();
    const cfg = (data?.image_config ?? {}) as Partial<ImageConfig>;

    return ok({
      imageEnabled: data?.image_enabled ?? false,
      backgroundUrl: cfg.backgroundUrl ?? null,
      avatar: { ...DEFAULT_CONFIG.avatar, ...cfg.avatar },
      text: { ...DEFAULT_CONFIG.text, ...cfg.text },
    });
  } catch (error) {
    console.error('[dashboard/bot/welcome-image][GET]', error);
    return internalError();
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    if (!verifyCsrf(req)) return fail('csrf_failed', 'رمز الحماية غير صالح. أعد تحميل الصفحة.', 403);
    const session = await getSession();
    if (!session) return fail('unauthorized', 'Login required', 401);
    const r = await ownedSystemBot(session.discordUserId, id);
    if ('error' in r) return r.error;
    if (!isOwnerId(session.discordUserId) && (r.bot.status === 'expired' || r.bot.status === 'cancelled')) return fail('forbidden', 'الاشتراك منتهي. جدّد للتعديل.', 403);
    if (!rateLimit(req, 'bot:welcome-image', 12, 60_000).allowed) return fail('rate_limited', 'محاولات كثيرة. انتظر دقيقة.', 429);

    const form = await req.formData().catch(() => null);
    if (!form) return fail('bad_request', 'بيانات غير صالحة.', 400);

    const num = (key: string) => {
      const v = form.get(key);
      return v === null ? NaN : Number(v);
    };

    const enabled = form.get('enabled') === 'true';
    const avatar = {
      xPct: clamp01(num('avatarX'), DEFAULT_CONFIG.avatar.xPct),
      yPct: clamp01(num('avatarY'), DEFAULT_CONFIG.avatar.yPct),
      radiusPct: Math.min(0.45, Math.max(0.03, num('avatarRadius') || DEFAULT_CONFIG.avatar.radiusPct)),
    };
    const colorRaw = String(form.get('textColor') ?? '');
    const text = {
      xPct: clamp01(num('textX'), DEFAULT_CONFIG.text.xPct),
      yPct: clamp01(num('textY'), DEFAULT_CONFIG.text.yPct),
      fontSizePct: Math.min(0.2, Math.max(0.01, num('textSize') || DEFAULT_CONFIG.text.fontSizePct)),
      color: /^#[0-9a-fA-F]{6}$/.test(colorRaw) ? colorRaw : DEFAULT_CONFIG.text.color,
    };

    // الصورة الحالية (نحتفظ فيها إذا العميل ما رفع صورة جديدة هالمرة).
    const { data: existing } = await supabaseAdmin().from('guild_welcome').select('image_config').eq('guild_id', r.bot.guild_id).maybeSingle();
    let backgroundUrl = (existing?.image_config as Partial<ImageConfig> | null)?.backgroundUrl ?? null;

    const file = form.get('image');
    if (file instanceof File && file.size > 0) {
      if (file.size > MAX_BYTES) return fail('bad_request', 'الصورة كبيرة جداً (الحد الأقصى 5 ميجا).', 400);
      if (!ALLOWED_TYPES.has(file.type)) return fail('bad_request', 'صيغة غير مدعومة. استخدم PNG أو JPEG أو WEBP.', 400);

      const bytes = Buffer.from(await file.arrayBuffer());
      const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
      const path = `${r.bot.guild_id}.${ext}`;
      const { error: uploadError } = await supabaseAdmin().storage.from(BUCKET).upload(path, bytes, { contentType: file.type, upsert: true });
      if (uploadError) throw uploadError;

      const { data: pub } = supabaseAdmin().storage.from(BUCKET).getPublicUrl(path);
      backgroundUrl = `${pub.publicUrl}?v=${Date.now()}`; // كسر الكاش بعد كل رفعة جديدة
    }

    if (enabled && !backgroundUrl) return fail('bad_request', 'ارفع صورة الخلفية أولاً.', 400);

    const { error } = await supabaseAdmin().from('guild_welcome').upsert(
      {
        guild_id: r.bot.guild_id,
        image_enabled: enabled,
        image_config: { backgroundUrl, avatar, text },
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'guild_id' },
    );
    if (error) throw error;

    await logWebsiteEvent({
      eventType: 'welcome_image_update',
      message: 'Customer updated welcome image config',
      userId: session.discordUserId,
      guildId: r.bot.guild_id,
      botInstanceId: id,
      metadata: { enabled, uploadedNewImage: file instanceof File && file.size > 0 },
    }).catch(() => {});

    return ok({ saved: true, backgroundUrl, avatar, text });
  } catch (error) {
    console.error('[dashboard/bot/welcome-image][POST]', error);
    return internalError();
  }
}
