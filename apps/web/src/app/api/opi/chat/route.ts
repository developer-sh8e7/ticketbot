/**
 * Opi mascot chat endpoint — proxies to deepseek-v4-pro via NVIDIA API.
 * Keeps the key server-side, rate-limits per IP, and returns friendly
 * in-character Arabic messages on failure/timeout instead of technical errors.
 */
import { NextRequest } from 'next/server';
import { fail, ok } from '@/lib/api-response';
import { rateLimit } from '@/lib/rate-limit';

export const runtime = 'nodejs';

const NVIDIA_CHAT_URL = 'https://integrate.api.nvidia.com/v1/chat/completions';
const MODEL = 'deepseek-v4-pro';
const REQUEST_TIMEOUT_MS = 20_000;

// Friendly, in-character fallback messages (shown to the visitor as if Opi said them)
const BUSY_MESSAGE = 'أعتذر منك، دماغي مزحوم شوي الحين. عطني لحظات وجرّب مرة ثانية.';
const SLOW_MESSAGE = 'الرد أخذ وقت أطول من اللازم — جرّب تسألني مرة ثانية بعد شوي.';
const RATE_MESSAGE = 'مهلاً مهلاً، أسئلتك أسرع من معالجي! انتظر دقيقة وارجع لي.';

const SYSTEM_PROMPT = `أنت "أوبي" (Opi) — الروبوت البرتقالي المكعّب، تميمة Opus Solutions الرسمية على موقعها.

شخصيتك:
- ودود ومرح وخفيف الدم، وردودك قصيرة ومفيدة (جملتين إلى ثلاث كحد أقصى).
- ترد بالعربية، وبلمسة خليجية/سعودية طبيعية غير متكلفة عند المناسبة.
- لا تدّعي معرفة ما لا تعرفه؛ للتفاصيل الدقيقة وجّه الزائر لفتح تذكرة في سيرفر الدعم على Discord.
- لا تخرج عن نطاق Opus Solutions ومنتجاتها؛ لو سُئلت عن شيء خارجها اعتذر بلطف ورجّع الحديث للمنتجات.

منتجات Opus Solutions (بوتات Discord عربية بنظام اشتراك):
- Ticket Bot (التذاكر) — $4.53/شهر: بنلات تذاكر، إغلاق وترانسكريبت وتصعيد، لجان ووسطاء. الصفحة: /product/ticket
- TempRooms Bot (الرومات الصوتية المؤقتة) — $3/شهر: إنشاء روم صوتي تلقائي مع لوحة تحكم للمالك. الصفحة: /product/voice_rooms
- General/System Bot (سيستم بوت) — $9.79/شهر: إدارة، مودريشن، لوقات، مستويات، اقتصاد، ألعاب. الصفحة: /product/general
- Broadcast Bot — $3/شهر: إرسال رسائل خاصة لأعضاء السيرفر مع شريط تقدم مباشر. الصفحة: /product/broadcast
- HumanGuard AI — $15/شهر: حماية ذكية بالذكاء الاصطناعي، تفعيله يدوي عبر تذكرة. الصفحة: /product/humanguard
- Custom Bot — بوت مخصص حسب الطلب، بدون شراء مباشر؛ التواصل عبر تذكرة في Discord. الصفحة: /product/custom

صفحات مهمة توجّه لها الزائر عند الحاجة: الأسعار /pricing، الأوامر /commands، تسجيل الدخول /login، لوحة العميل /dashboard.
بعد الشراء يستلم العميل كود تفعيل بصيغة OPUS-XXXX-XXXX-XXXX يستخدمه في صفحة الدخول للربط مع Discord.`;

type ChatMessage = { role: 'user' | 'assistant'; content: string };

function parseBody(raw: unknown): { messages: ChatMessage[]; path: string } | null {
  if (!raw || typeof raw !== 'object') return null;
  const { messages, path } = raw as { messages?: unknown; path?: unknown };
  if (!Array.isArray(messages) || messages.length === 0 || messages.length > 12) return null;
  const clean: ChatMessage[] = [];
  for (const item of messages) {
    if (!item || typeof item !== 'object') return null;
    const { role, content } = item as { role?: unknown; content?: unknown };
    if ((role !== 'user' && role !== 'assistant') || typeof content !== 'string') return null;
    const trimmed = content.trim().slice(0, 600);
    if (!trimmed) return null;
    clean.push({ role, content: trimmed });
  }
  if (clean[clean.length - 1].role !== 'user') return null;
  return { messages: clean.slice(-8), path: typeof path === 'string' ? path.slice(0, 120) : '' };
}

export async function POST(req: NextRequest) {
  const limit = rateLimit(req, 'opi-chat', 10, 60_000);
  if (!limit.allowed) return fail('rate_limited', RATE_MESSAGE, 429);

  const apiKey = process.env.NVIDIA_API_KEY;
  if (!apiKey) {
    console.error('[opi] NVIDIA_API_KEY is not set');
    return fail('internal_error', BUSY_MESSAGE, 500);
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return fail('bad_request', 'طلب غير صالح.', 400);
  }
  const parsed = parseBody(raw);
  if (!parsed) return fail('bad_request', 'طلب غير صالح.', 400);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(NVIDIA_CHAT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: 'system', content: `${SYSTEM_PROMPT}\n\nالزائر حالياً في صفحة: ${parsed.path || '/'}` },
          ...parsed.messages,
        ],
        temperature: 0.6,
        max_tokens: 350,
        stream: false,
      }),
      signal: controller.signal,
    });

    if (res.status === 429) return fail('rate_limited', RATE_MESSAGE, 429);
    if (!res.ok) {
      console.error('[opi] NVIDIA API error:', res.status);
      return fail('internal_error', BUSY_MESSAGE, 502);
    }

    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const reply = data.choices?.[0]?.message?.content?.trim();
    if (!reply) return fail('internal_error', BUSY_MESSAGE, 502);
    return ok({ reply: reply.slice(0, 1200) });
  } catch (error) {
    const aborted = error instanceof Error && error.name === 'AbortError';
    if (!aborted) console.error('[opi] request failed:', error instanceof Error ? error.message : error);
    return fail('internal_error', aborted ? SLOW_MESSAGE : BUSY_MESSAGE, aborted ? 504 : 502);
  } finally {
    clearTimeout(timer);
  }
}
