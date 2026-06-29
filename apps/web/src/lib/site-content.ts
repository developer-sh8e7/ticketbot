export const site = {
  name: 'Opus Solutions',
  supportDiscordUrl: 'https://discord.gg/ahGvNTKyuv',
  xUrl: '#',
  socialX: '#',
  socialDiscord: 'https://discord.gg/ahGvNTKyuv',
  socialYoutube: '#',
  socialEmail: '#',
  tagline: 'حلول بوتات Discord عربية لإدارة وتنمية سيرفراتك.'
};

export function extractPriceFromLabel(priceLabel: string) {
  const price = priceLabel.match(/(\d+(?:[.,]\d+)?)/)?.[1]?.replace(',', '.');
  return price || null;
}

export function getPayPalHrefFromPriceLabel(priceLabel: string) {
  const price = extractPriceFromLabel(priceLabel);
  return price ? `https://paypal.me/AAlamri381/${price}` : '/pricing';
}

function normalizePriceLabel(price: string) {
  return price.replace(/\.00$/, '');
}

/**
 * Centralized product prefix map for activation codes.
 * All code generation MUST use this map, not hardcoded strings.
 * Old OPUS-TICKET codes remain valid — new codes use the prefix for their product type.
 */
export const PRODUCT_PREFIX_MAP: Record<string, string> = {
  ticket: 'TICKET',
  system: 'SYSTEM',
  verify: 'VERIFY',
  welcome: 'WELCOME',
  humanguard: 'HUMANGUARD',
  custom: 'CUSTOM',
  games: 'GAMES',
  broadcast: 'BROADCAST',
  backup: 'BACKUP',
  roles: 'ROLES',
};

/** Default prefix used when product type is unknown or not in the map. */
export const DEFAULT_PRODUCT_PREFIX = 'SOLUTIONS';

export function getProductPrefix(productType: string): string {
  return PRODUCT_PREFIX_MAP[productType] || DEFAULT_PRODUCT_PREFIX;
}

export function formatActivationCode(productType: string): string {
  const prefix = getProductPrefix(productType);
  return `OPUS-${prefix}-XXXX-XXXX`;
}

export type ProductKey = 'ticket' | 'voice_rooms' | 'general' | 'humanguard' | 'custom';

export type Product = {
  key: ProductKey;
  id: string;
  name: string;
  icon: string;
  shortName: string;
  description: string;
  shortDescription: string;
  priceLabel: string;
  price_monthly: number;
  price_quarterly: number;
  productUrl?: string;
  badge?: string;
  features: string[];
  activationCodePrefix: string;
  productType: string;
  featured?: boolean;
  manualActivation?: boolean;
};

export function products(): Product[] {
  const all: Product[] = [
    {
      key: 'ticket',
      id: 'ticket-bot',
      name: 'Ticket Bot',
      icon: 'Ticket',
      shortName: 'التذاكر',
      shortDescription: 'بوت تذاكر متكامل لإدارة طلبات العملاء داخل سيرفرك.',
      badge: 'متوفر الآن',
      description: 'بوت تذاكر Opus لإدارة إنشاء وإغلاق التذاكر، البنلات، الترانسكريبت، اللجان، التصعيد، والرولات من إعدادات محفوظة لكل سيرفر.',
      priceLabel: '$4.53 / شهر',
      price_monthly: 4.53,
      price_quarterly: 12.94,
      activationCodePrefix: 'TICKET',
      productType: 'ticket',
      featured: true,
      features: ['بنلات تذاكر قابلة للتعديل', 'إغلاق وترانسكريبت وتصعيد', 'لجان ووسطاء وشكاوى', 'Config محفوظ لكل سيرفر', 'تجديد يرجع نفس البوت والإعدادات'],
    },
    {
      key: 'voice_rooms',
      id: 'voice-rooms-bot',
      name: 'TempRooms Bot',
      icon: 'Mic2',
      shortName: 'الرومات المؤقتة',
      shortDescription: 'Join-to-create voice rooms مع لوحة تحكم كاملة للمالك.',
      description: 'ينشئ روم صوتي مؤقت عند دخول قناة الإنشاء، مع قفل/فتح، إخفاء/إظهار، طرد، حظر، تغيير الاسم والحد، نقل الملكية وحذف الروم عند الفراغ.',
      priceLabel: '$3 / شهر',
      price_monthly: 3.00,
      price_quarterly: 9.00,
      activationCodePrefix: 'TEMPROOMS',
      productType: 'voice_rooms',
      features: ['إنشاء روم تلقائي', 'لوحة تحكم للمالك', 'حظر وسماح وطرد', 'نقل ملكية وحذف تلقائي', 'استرجاع الحالة بعد restart'],
    },
    {
      key: 'general',
      id: 'general-system-bot',
      name: 'General/System Bot',
      icon: 'Bot',
      shortName: 'سيستم بوت',
      shortDescription: 'إدارة ومودريشن ولوقات ومستويات واقتصاد وألعاب خفيفة.',
      description: 'SystemBot يساعدك على إدارة سيرفر Discord بأوامر المودريشن، اللوقات، الترحيب، الحماية، المستويات، الاقتصاد والأوامر العامة.',
      priceLabel: '$9.79 / شهر',
      price_monthly: 9.79,
      price_quarterly: 28.71,
      activationCodePrefix: 'SYSTEM',
      productType: 'general',
      features: ['أوامر إدارة ومودريشن', 'لوقات وترحيب ومغادرة', 'مستويات واقتصاد', 'حماية وروابط وسبام', 'ألعاب وأوامر معلومات'],
    },
    {
      key: 'humanguard',
      id: 'humanguard-ai',
      name: 'HumanGuard AI',
      icon: 'ShieldCheck',
      shortName: 'حماية AI',
      shortDescription: 'بوت حماية ذكي يكتشف ويصدّ التهديدات داخل سيرفرك تلقائياً.',
      description: 'HumanGuard AI يحمي سيرفرك من الرايدات، الإزعاج، والتهديدات باستخدام نظام AI متقدم. التفعيل يدوي عبر تكت مع كود خاص.',
      priceLabel: '$15 / شهر',
      price_monthly: 15.00,
      price_quarterly: 45.00,
      activationCodePrefix: 'HUMANGUARD',
      productType: 'humanguard',
      manualActivation: true,
      features: ['كشف تهديدات بالذكاء الاصطناعي', 'حماية من الرايدات والسبام', 'تحليل سلوك الأعضاء', 'تفعيل يدوي بكود خاص', 'إعدادات مخصصة لكل سيرفر'],
    },
    {
      key: 'custom',
      id: 'custom-bot',
      name: 'Custom Bot',
      icon: 'Code2',
      shortName: 'بوت مخصص',
      shortDescription: 'بوت Discord خاص حسب احتياج سيرفرك الفريد.',
      description: 'Custom Bot هو بوت يتم بناؤه حسب فكرتك واحتياجك. لا يوجد شراء مباشر؛ اضغط تواصل مع المطورين وافتح تذكرة في Discord.',
      priceLabel: 'تواصل معنا',
      price_monthly: 0,
      price_quarterly: 0,
      activationCodePrefix: 'CUSTOM',
      productType: 'custom',
      features: ['تحليل المتطلبات', 'تطوير مخصص', 'تسليم موثق', 'دعم بعد التسليم حسب الاتفاق'],
    },
  ];

  return all.map((product) => {
    const productUrl = product.productType === 'custom' ? site.supportDiscordUrl : getPayPalHrefFromPriceLabel(product.priceLabel);
    return productUrl.startsWith('http') ? { ...product, productUrl } : product;
  });
}


export const primaryFeatures = [
  {
    title: 'أوامر إدارية متقدمة',
    description: 'تنظيم عمليات السيرفر اليومية بأوامر واضحة ومصممة للاستخدام داخل Discord.',
    points: ['صلاحيات مدروسة', 'تجربة Slash Commands', 'إعدادات قابلة للتخصيص'],
  },
  {
    title: 'تحكم بالتذاكر والقنوات',
    description: 'إدارة تذاكر العملاء من فتح الطلب وحتى الإغلاق والتوثيق بدون فوضى.',
    points: ['بنلات تذاكر', 'رولات دعم', 'لوقات وتنظيم القنوات'],
  },
  {
    title: 'حماية وتجربة موثوقة',
    description: 'تصميم يقلل الأخطاء ويحافظ على وصول العملاء لبياناتهم وخدماتهم.',
    points: ['تفعيل عبر Discord OAuth', 'جلسات آمنة', 'ربط اشتراك واضح'],
  },
];

export const faq = [
  ['كيف أستلم كود التفعيل؟', 'بعد اكتمال الشراء، يتم إنشاء كود تفعيل خاص بالمنتج الذي اشتريته (مثلاً OPUS-XXXXX-XXXX-XXXX)، ثم تستخدمه في صفحة دخول العميل للربط مع Discord.'],
  ['ماذا يحدث إذا لم أجدد الاشتراك؟', 'الخدمة قد تتحول إلى وضع محدود أو منتهي حسب حالة الاشتراك. صفحة Billing توضّح الحالة ورابط التجديد.'],
  ['كم يستغرق تنفيذ بوت مخصص؟', 'البوتات المخصصة تعتمد على نطاق المتطلبات. يتم تحديد المدة والسعر بعد مراجعة الطلب مع فريق Opus.'],
  ['ما طرق الدفع المتاحة؟', 'طرق الدفع هي الطرق المفعّلة داخل منصة الدفع فقط.'],
  ['هل يمكن نقل البوت إلى سيرفر آخر؟', 'يعتمد ذلك على حالة الاشتراك والربط الحالي. تواصل مع دعم Opus لمراجعة الحالة قبل النقل.'],
];

export type CommandCategory = 'الكل' | 'تذاكر' | 'إدارة' | 'حماية' | 'عام';

export const commands = [
  { name: '/panel_send', category: 'تذاكر' as const, description: 'يرسل بنل فتح التذاكر داخل القناة المحددة.' },
  { name: '/panel_refresh', category: 'تذاكر' as const, description: 'يحدث بنل التذاكر الحالي بدون إعادة إعداد كاملة.' },
  { name: '/ticket_close', category: 'تذاكر' as const, description: 'يغلق التذكرة الحالية مع سبب اختياري.' },
  { name: '/ticket_stats', category: 'إدارة' as const, description: 'يعرض ملخص إحصائيات التذاكر.' },
  { name: '/restore-panel', category: 'عام' as const, description: 'يسترجع لوحة التذاكر عند الحاجة.' },
];

export const commandCategories: CommandCategory[] = ['الكل', 'تذاكر', 'إدارة', 'حماية', 'عام'];
