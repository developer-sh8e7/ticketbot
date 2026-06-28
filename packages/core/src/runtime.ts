import type { ProductType } from './types.js';

/**
 * عقد تشغيل موحّد لكل البوتات.
 * الأوركستريتر يستدعي factory الخاص بكل منتج بنفس الشكل،
 * ويمرّر التوكن (بعد فك تشفيره) + إعدادات السيرفر المحفوظة.
 *
 * لا يعتمد هذا الملف على discord.js عمداً — حتى تبقى النواة خفيفة
 * وتظل البوتات حرّة في اختيار إصدار/إعداد مكتبتها.
 */
export interface BotRuntimeOptions {
  /** توكن البوت بعد فك التشفير — يبقى في الذاكرة فقط */
  token: string;
  /** السيرفر المخصّص لهذه النسخة */
  guildId: string;
  /** صاحب الاشتراك */
  ownerId: string;
  /** معرّف نسخة البوت في قاعدة البيانات */
  instanceId: string;
  /** إعدادات السيرفر المحفوظة لهذا (السيرفر × المنتج) — تُجلب من server_configs */
  config: Record<string, unknown>;
  /** اتصال Supabase (Service Role) لمشاركة العميل بدل فتح اتصال لكل بوت */
  supabaseUrl: string;
  supabaseServiceRoleKey: string;
}

export interface RunningBot {
  readonly productType: ProductType;
  readonly instanceId: string;
  /** تسجيل الدخول وبدء الاستقبال. يعيد معرّف مستخدم البوت بعد الجاهزية. */
  start(): Promise<{ botUserId: string }>;
  /** إيقاف نظيف وتدمير العميل (الإعدادات تبقى في قاعدة البيانات). */
  stop(): Promise<void>;
}

export type BotFactory = (options: BotRuntimeOptions) => RunningBot;
