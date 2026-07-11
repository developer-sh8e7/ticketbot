/**
 * Opi mascot chat endpoint — proxies to NVIDIA API (deepseek-v4-flash or GLM-5.2).
 * Default: deepseek-ai/deepseek-v4-flash (fast, short replies for Opi persona).
 * Optional: z-ai/glm-5.2 (strong reasoning & coding) — send { model: "glm" } in body.
 *
 * Keeps keys server-side, rate-limits per IP, returns friendly
 * in-character Arabic messages on failure/timeout instead of technical errors.
 */
import { NextRequest } from 'next/server';
import { fail, ok } from '@/lib/api-response';
import { rateLimit } from '@/lib/rate-limit';

export const runtime = 'nodejs';
export const maxDuration = 30;

const NVIDIA_CHAT_URL = 'https://integrate.api.nvidia.com/v1/chat/completions';

// Model definitions
const MODELS = {
  flash: {
    id: 'deepseek-ai/deepseek-v4-flash',
    key: () => process.env.NVIDIA_API_KEY || '',
    timeout: 8_000,
    maxTokens: 350,
    temperature: 0.6,
    extra: { chat_template_kwargs: { thinking: false } },
  },
  glm: {
    id: process.env.NVIDIA_GLM_MODEL || 'z-ai/glm-5.2',
    key: () => process.env.NVIDIA_GLM_API_KEY || process.env.NVIDIA_API_KEY || '',
    timeout: 25_000,
    maxTokens: 800,
    temperature: 0.5,
    extra: {},
  },
} as const;

type ModelKey = keyof typeof MODELS;

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

function parseBody(raw: unknown): { messages: ChatMessage[]; path: string; model?: string } | null {
  if (!raw || typeof raw !== 'object') return null;
  const { messages, path, model } = raw as { messages?: unknown; path?: unknown; model?: unknown };
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
  return {
    messages: clean.slice(-8),
    path: typeof path === 'string' ? path.slice(0, 120) : '',
    model: typeof model === 'string' ? model : undefined,
  };
}

export async function POST(req: NextRequest) {
  const limit = rateLimit(req, 'opi-chat', 10, 60_000);
  if (!limit.allowed) return fail('rate_limited', RATE_MESSAGE, 429);

  // Determine which model to use
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return fail('bad_request', 'طلب غير صالح.', 400);
  }
  const parsed = parseBody(raw);
  if (!parsed) return fail('bad_request', 'طلب غير صالح.', 400);

  const modelKey: ModelKey = parsed.model === 'glm' ? 'glm' : 'flash';
  const config = MODELS[modelKey];
  const apiKey = config.key();

  if (!apiKey) {
    console.error(`[opi] API key not set for model "${modelKey}"`);
    // Fallback: try the other model's key
    const fallbackKey = modelKey === 'glm' ? MODELS.flash.key() : MODELS.glm.key();
    if (!fallbackKey) return ok({ reply: BUSY_MESSAGE });
    // Use the fallback key with the original model config
    const res = await makeRequest(fallbackKey, config, parsed);
    return ok({ reply: res ?? BUSY_MESSAGE });
  }

  const reply = await makeRequest(apiKey, config, parsed);
  return ok({ reply: reply ?? BUSY_MESSAGE });
}

async function makeRequest(
  apiKey: string,
  config: (typeof MODELS)[ModelKey],
  parsed: { messages: ChatMessage[]; path: string },
): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.timeout);
  try {
    const res = await fetch(NVIDIA_CHAT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: config.id,
        messages: [
          { role: 'system', content: `${SYSTEM_PROMPT}\n\nالزائر حالياً في صفحة: ${parsed.path || '/'}` },
          ...parsed.messages,
        ],
        temperature: config.temperature,
        max_tokens: config.maxTokens,
        stream: false,
        ...config.extra,
      }),
      signal: controller.signal,
    });

    if (res.status === 429) return RATE_MESSAGE;
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      console.error(`[opi] NVIDIA API error (${config.id}):`, res.status, detail.slice(0, 300));
      return null;
    }

    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const reply = data.choices?.[0]?.message?.content?.trim();
    if (!reply) return null;
    return reply.slice(0, modelMaxLength(config.id));
  } catch (error) {
    const aborted = error instanceof Error && error.name === 'AbortError';
    if (!aborted) console.error(`[opi] request failed (${config.id}):`, error instanceof Error ? error.message : error);
    return aborted ? SLOW_MESSAGE : null;
  } finally {
    clearTimeout(timer);
  }
}

function modelMaxLength(modelId: string): number {
  if (modelId.includes('glm')) return 2400;
  return 1200;
}
