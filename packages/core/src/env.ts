import 'dotenv/config';
import { z } from 'zod';

/**
 * نواة متغيرات البيئة المشتركة بين كل الحزم.
 * كل تطبيق (bot/orchestrator) يوسّع هذه القاعدة بمتغيراته الخاصة عبر coreEnvSchema.extend(...).
 */
export const coreEnvSchema = z.object({
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  TOKEN_ENCRYPTION_KEY: z.string().min(1),
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
});

export type CoreEnv = z.infer<typeof coreEnvSchema>;

function trim(value: string | undefined): string | undefined {
  const t = value?.trim();
  return t ? t : undefined;
}

/**
 * يحمّل ويتحقق من متغيرات البيئة باستخدام schema معطى (افتراضياً النواة).
 * مرّر schema موسّع من التطبيق ليتحقق من كل متغيراته دفعة واحدة.
 */
export function loadEnv<T extends z.ZodTypeAny = typeof coreEnvSchema>(
  schema?: T,
): z.infer<T> {
  const active = (schema ?? coreEnvSchema) as z.ZodTypeAny;
  const parsed = active.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`فشل التحقق من متغيرات البيئة:\n${issues}`);
  }
  return parsed.data as z.infer<T>;
}

export { trim as trimEnv };
