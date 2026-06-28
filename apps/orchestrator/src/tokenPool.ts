import type { SupabaseClient, ProductType, TokenPoolRecord } from '@opus/core';
import { encryptToken } from '@opus/core';

/**
 * واجهة بركة التوكنات. كل السحب يمرّ عبر دالة claim_token في قاعدة البيانات
 * (FOR UPDATE SKIP LOCKED) — لا نسحب أبداً من كود التطبيق مباشرة، لضمان الذرّية.
 */
export class TokenPoolRepository {
  public constructor(
    private readonly supabase: SupabaseClient,
    private readonly encryptionKey: string,
  ) {}

  /** إضافة توكن جديد للبركة (مشفّراً). للإدارة عند تسجيل بوتات جديدة. */
  public async addToken(input: {
    productType: ProductType;
    botApplicationId: string;
    plainToken: string;
    label?: string;
  }): Promise<void> {
    const encrypted = encryptToken(input.plainToken, this.encryptionKey);
    const { error } = await this.supabase.from('token_pool').insert({
      product_type: input.productType,
      bot_application_id: input.botApplicationId,
      bot_token_encrypted: encrypted,
      status: 'available',
      label: input.label ?? null,
    });
    if (error) throw new Error(`فشل إضافة التوكن للبركة: ${error.message}`);
  }

  /** عدد التوكنات المتاحة لمنتج — لتنبيه الإدارة قبل النفاد. */
  public async availableCount(productType: ProductType): Promise<number> {
    const { data, error } = await this.supabase.rpc('available_token_count', {
      p_product_type: productType,
    });
    if (error) throw new Error(`فشل عدّ التوكنات: ${error.message}`);
    return (data as number) ?? 0;
  }

  /** تحرير توكن نسخة (عند الإلغاء النهائي فقط). */
  public async release(instanceId: string): Promise<void> {
    const { error } = await this.supabase.rpc('release_token', { p_instance_id: instanceId });
    if (error) throw new Error(`فشل تحرير التوكن: ${error.message}`);
  }

  /** جلب التوكن المحجوز لنسخة (لفك تشفيره عند التشغيل). */
  public async findByInstance(instanceId: string): Promise<TokenPoolRecord | null> {
    const { data, error } = await this.supabase
      .from('token_pool')
      .select('*')
      .eq('claimed_by_instance_id', instanceId)
      .maybeSingle();
    if (error) throw new Error(`فشل جلب توكن النسخة: ${error.message}`);
    return data as TokenPoolRecord | null;
  }
}
