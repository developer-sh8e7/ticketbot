/**
 * الأنواع المشتركة لنطاق العمل (domain) بين الأوركستريتر والبوتات.
 * مصدر الحقيقة الوحيد لأنواع المنتجات والحالات.
 */

/** أنواع المنتجات = البوتات المنفصلة + امتدادات مستقبلية */
export const PRODUCT_TYPES = ['ticket', 'voice_rooms', 'general', 'broadcast'] as const;
export type ProductType = (typeof PRODUCT_TYPES)[number];

/** حالة نسخة البوت / الاشتراك */
export const SERVICE_STATUSES = ['active', 'expired', 'cancelled', 'paused', 'rejected'] as const;
export type ServiceStatus = (typeof SERVICE_STATUSES)[number];

/** حالة التوكن داخل البركة */
export const TOKEN_STATUSES = ['available', 'claimed', 'disabled'] as const;
export type TokenStatus = (typeof TOKEN_STATUSES)[number];

export type PlanType = 'trial' | 'paid';

/** سجل توكن داخل بركة التوكنات (jt: token_pool) */
export interface TokenPoolRecord {
  id: string;
  product_type: ProductType;
  bot_application_id: string;        // Discord application/client ID
  bot_token_encrypted: string;       // Fernet-encrypted — لا يُكشف أبداً
  status: TokenStatus;
  claimed_by_instance_id: string | null;
  claimed_at: string | null;
  label: string | null;
  created_at: string;
  updated_at: string;
}

/** نسخة بوت مُشغّلة لزبون معيّن */
export interface BotInstanceRecord {
  id: string;
  product_type: ProductType;
  token_id: string | null;           // FK → token_pool.id
  bot_application_id: string | null;
  bot_user_id: string | null;
  bot_name: string | null;
  guild_id: string;
  guild_name: string | null;
  owner_id: string;                  // Discord user ID لصاحب الاشتراك
  account_id: string | null;         // FK → accounts.id (الربط الإجباري)
  plan_type: PlanType;
  status: ServiceStatus;
  started_at: string | null;
  expires_at: string | null;
  last_started_at: string | null;
  last_stopped_at: string | null;
  created_at: string;
  updated_at: string;
}

/** إعدادات سيرفر محفوظة لكل (سيرفر × منتج) — تبقى حتى لو توقف البوت */
export interface ServerConfigRecord {
  id: string;
  guild_id: string;
  product_type: ProductType;
  config_data: Record<string, unknown>;
  updated_at: string;
  created_at: string;
}

export interface SubscriptionRecord {
  id: string;
  account_id: string | null;
  owner_id: string;
  guild_id: string;
  product_type: ProductType;
  instance_id: string | null;
  plan_name: string;
  status: ServiceStatus;
  starts_at: string;
  expires_at: string;
  created_at: string;
  updated_at: string;
}

export function isProductType(value: unknown): value is ProductType {
  return typeof value === 'string' && (PRODUCT_TYPES as readonly string[]).includes(value);
}
