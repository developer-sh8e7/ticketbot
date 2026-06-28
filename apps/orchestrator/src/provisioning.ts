import type { SupabaseClient, ProductType, BotInstanceRecord } from '@opus/core';
import { createLogger, isExemptGuild } from '@opus/core';

/** مدة عملية (≈100 سنة) تُستخدم للسيرفرات المستثناة حتى لا تنتهي أبداً. */
const NEVER_EXPIRE_DAYS = 36500;

const log = createLogger('provisioning');

export class AccountNotLinkedError extends Error {
  public constructor(discordUserId: string) {
    super(`الحساب غير مربوط: ${discordUserId} — يجب ربط حساب Discord قبل الشراء.`);
    this.name = 'AccountNotLinkedError';
  }
}

export class NoTokenAvailableError extends Error {
  public constructor(productType: ProductType) {
    super(`لا يوجد توكن متاح للمنتج ${productType} — تواصل مع الإدارة لإضافة المزيد للبركة.`);
    this.name = 'NoTokenAvailableError';
  }
}

/**
 * خدمة التفعيل. تُستدعى عند تأكيد الدفع (PayPal webhook).
 * تفرض الربط الإجباري، ثم تفعّل ذرّياً عبر provision_instance، ثم تطلب من المدير تشغيل البوت.
 */
export class ProvisioningService {
  public constructor(private readonly supabase: SupabaseClient) {}

  /** الربط الإجباري: يعيد account_id أو يرمي خطأ إن لم يكن الحساب مربوطاً. */
  private async requireLinkedAccount(discordUserId: string): Promise<string> {
    const { data, error } = await this.supabase
      .from('accounts')
      .select('id')
      .eq('discord_user_id', discordUserId)
      .maybeSingle();
    if (error) throw new Error(`فشل التحقق من الحساب: ${error.message}`);
    if (!data) throw new AccountNotLinkedError(discordUserId);
    return data.id as string;
  }

  /**
   * تفعيل اشتراك جديد أو تجديد. ذرّي بالكامل عبر دالة قاعدة البيانات.
   * يعيد سجل النسخة (active) جاهزاً ليشغّله المدير.
   */
  public async provision(input: {
    discordUserId: string;
    guildId: string;
    guildName?: string | null;
    productType: ProductType;
    planName?: string;
    durationDays?: number;
    externalRef?: string | null;
  }): Promise<BotInstanceRecord> {
    // السيرفر المستثنى (المتجر) يعمل دائماً: لا ربط حساب إجباري ولا انتهاء.
    const exempt = isExemptGuild(input.guildId);
    const accountId = exempt ? null : await this.requireLinkedAccount(input.discordUserId);

    const { data, error } = await this.supabase.rpc('provision_instance', {
      p_account_id: accountId,
      p_owner_id: input.discordUserId,
      p_guild_id: input.guildId,
      p_guild_name: input.guildName ?? null,
      p_product_type: input.productType,
      p_plan_name: exempt ? 'store-exempt' : (input.planName ?? 'monthly'),
      p_duration_days: exempt ? NEVER_EXPIRE_DAYS : (input.durationDays ?? 30),
      p_external_ref: input.externalRef ?? null,
    });

    if (error) {
      if (/NO_TOKEN_AVAILABLE/.test(error.message)) {
        throw new NoTokenAvailableError(input.productType);
      }
      throw new Error(`فشل التفعيل: ${error.message}`);
    }

    log.info(`✅ تم تفعيل ${input.productType} للسيرفر ${input.guildId} (الحساب ${accountId})`);
    return data as BotInstanceRecord;
  }

  /** إلغاء/إيقاف نسخة (انتهاء أو طلب إلغاء). الإعدادات تبقى محفوظة في server_configs. */
  public async deactivate(instanceId: string, status: 'expired' | 'cancelled'): Promise<void> {
    const { error } = await this.supabase
      .from('bot_instances')
      .update({ status, last_stopped_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('id', instanceId);
    if (error) throw new Error(`فشل إيقاف النسخة: ${error.message}`);
  }
}
