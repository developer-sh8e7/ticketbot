/**
 * السيرفرات المستثناة من نظام الاشتراكات.
 *
 * سيرفر المتجر الرسمي يعمل **دائماً** بدون اشتراك ولا توكن منتهٍ ولا ربط حساب،
 * وله أوامر إدارية خاصة غير متاحة للزبائن. أي مكان يفحص الاشتراك أو الانتهاء
 * أو الربط الإجباري يجب أن يستثني هذه السيرفرات أولاً.
 */
export const STORE_GUILD_ID = '1395842846107631746';

/** كل السيرفرات المعفاة من نظام الاشتراك (تعمل دائماً). */
export const EXEMPT_GUILD_IDS: readonly string[] = [STORE_GUILD_ID];

/** هل هذا السيرفر معفى من الاشتراك (يعمل دائماً)؟ */
export function isExemptGuild(guildId: string | null | undefined): boolean {
  return !!guildId && EXEMPT_GUILD_IDS.includes(guildId);
}

/**
 * هل يملك المستخدم صلاحيات إدارية خاصة بسيرفر المتجر؟
 * تُستخدم لإتاحة الأوامر الإدارية الخاصة في السيرفر المستثنى فقط.
 */
export function isStoreAdminContext(guildId: string | null | undefined): boolean {
  return guildId === STORE_GUILD_ID;
}
