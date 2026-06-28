# معمارية Opus Solutions

منصة بيع بوتات ديسكورد كاشتراكات. كل بوت منتج مستقل، فوق نواة مشتركة، تديره طبقة تحكم (orchestrator) تتولّى بركة التوكنات والتفعيل التلقائي ودورة حياة الاشتراك.

## المبدأ الأساسي

المشكلة في المشروع القديم: بوت التكتات، الغرف المؤقتة، والبوت العام كانت مدموجة في كود واحد (`src/`) بصلاحيات (intents) وأوامر متداخلة. النظام الجديد يفصل كل منتج في حزمة قائمة بذاتها، ويضع فوقها طبقة تحكم واحدة تعرف كيف تشغّل أي بوت دون أن تعرف تفاصيله الداخلية.

```
opus-solutions/
├── packages/
│   └── core/                 @opus/core — نواة مشتركة (env, logger, crypto, supabase, types, runtime contract)
├── apps/
│   ├── ticket-bot/           @opus/ticket-bot      — منتج التكتات (يصدّر createTicketBot)
│   ├── voice-rooms-bot/      @opus/voice-rooms-bot — منتج الغرف المؤقتة (يصدّر createVoiceRoomsBot)
│   ├── general-bot/          @opus/general-bot     — المنتج العام (يصدّر createGeneralBot)
│   └── orchestrator/         @opus/orchestrator    — طبقة التحكم (بركة التوكنات + التفعيل + المدير + webhook)
└── db/
    ├── schema/               سكيمة Supabase (SQL) — جداول + دوال ذرّية
    └── seed/                 بيانات أولية (إعدادات السيرفر الخاص)
```

## لماذا الفصل بهذا الشكل؟

كل بوت يصدّر **مصنعاً موحّداً** بالعقد `BotFactory` (في `@opus/core/runtime`):

```ts
type BotFactory = (options: BotRuntimeOptions) => RunningBot;
// RunningBot: { start(): Promise<{botUserId}>; stop(): Promise<void> }
```

نتيجة ذلك:
- **عزل تام**: لكل بوت intents وأوامر ومنطق خاص به. تعديل بوت التكتات لا يلمس البوت العام.
- **توحيد التشغيل**: الأوركستريتر يستدعي أي بوت بنفس الطريقة عبر `botRegistry` (خريطة منتج → مصنع).
- **نشر مستقل**: يمكن نشر/تحديث كل بوت على حدة، أو تشغيلها كلها تحت أوركستريتر واحد.

## بركة التوكنات والسحب الذرّي (النقطة الحرجة)

عندك مسبقاً 20 توكناً مسجّلاً لكل منتج، مخزّنة **مشفّرة** في جدول `token_pool`. عند الشراء يُسحب توكن واحد ذرّياً.

الضمان أن **زبونين لا يأخذان نفس التوكن أبداً** — ولو اشترى 100 شخص في نفس الجزء من الثانية — مبني على مستوى قاعدة البيانات:

```sql
select * from token_pool
 where product_type = $1 and status = 'available'
 order by created_at
 for update skip locked   -- ← كل معاملة تقفل صفاً مختلفاً وتتجاوز المقفول
 limit 1;
```

`FOR UPDATE SKIP LOCKED` يعني: كل عملية شراء متزامنة تحجز صفاً مقفولاً مختلفاً، فلا يحدث تنافس. يُكمّل ذلك **فهرس فريد جزئي** `uq_token_pool_one_claim_per_instance` يمنع ربط توكن واحد بأكثر من نسخة. كل هذا داخل دالة `claim_token()`، ولا يُسحب أي توكن من كود التطبيق مباشرة.

## دورة حياة الاشتراك

```
شراء (PayPal) ──▶ POST /internal/provision ──▶ provision_instance() [ذرّي]
                                                   │
        تحقّق الربط الإجباري ◀──────────────────────┤  (لا توكن بلا حساب مربوط)
                                                   ├─ claim_token()  → احجز توكن
                                                   ├─ أنشئ/جدّد bot_instances (active)
                                                   └─ سجّل subscription
                                                   │
                              المدير (sync) ──▶ يفك تشفير التوكن + يجلب server_configs ──▶ يشغّل البوت
```

- **عند الشراء**: البوت يدخل سيرفر الزبون ويشتغل فوراً دون تدخل يدوي.
- **عند الانتهاء**: المدير يعلّم النسخة `expired` ويوقف البوت — لكن **الإعدادات تبقى** في `server_configs` ولا تُحذف. التوكن يبقى محجوزاً للنسخة نفسها (لا يُحرَّر) ليرجع نفس البوت عند التجديد.
- **عند التجديد**: `provision_instance` يجد النسخة الموجودة، يعيدها `active`، ويمدّد `expires_at`. المدير يشغّلها ويجلب الإعدادات القديمة — كأنها ما وقفت.
- **عند الإلغاء النهائي**: `release_token()` يحرّر التوكن ليعود متاحاً لزبون آخر.

## الربط الإجباري قبل الشراء

`ProvisioningService.requireLinkedAccount()` يرفض أي تفعيل لمستخدم Discord غير موجود في جدول `accounts`. الحساب يُنشأ عند تسجيل الدخول بـ Discord OAuth في الموقع. هذا يحقق طلب: «لا يقدر يشتري إلا يربط حسابه أول». (نظام المفاتيح القديم أُسقط بالكامل — الربط الآن بحساب الشخص مباشرة.)

## التواصل بين الموقع ونظام البوتات

الموقع (Next.js) بعد تأكيد PayPal يستدعي `POST /internal/provision` في الأوركستريتر، محمياً بسرّ مشترك `MANAGER_SYNC_SECRET` (وفي الإنتاج: تحقق توقيع PayPal webhook عبر `PAYPAL_WEBHOOK_ID`). الردود: `409 account_not_linked`، `503 no_token_available`، `200 {instanceId, expiresAt}`.

## قاعدة البيانات (Supabase)

| جدول | الدور |
|------|------|
| `accounts` | الحسابات المربوطة (Discord OAuth) — شرط الشراء |
| `token_pool` | بركة التوكنات المشفّرة + `claim_token/release_token` |
| `bot_instances` | نسخ البوتات المُشغّلة لكل زبون |
| `server_configs` | إعدادات كل (سيرفر × منتج) — تبقى للأبد |
| `subscriptions` | الاشتراكات وتواريخها |
| `service_events` | سجل تدقيق لكل الأحداث |

دوال ذرّية: `claim_token`, `release_token`, `available_token_count`, `provision_instance`.

## السيرفر الخاص 1413059459630104626

زبون عادي بنفس النظام، لكن له إعدادات تكتات خاصة. محفوظة في `db/seed/config_1413059459630104626.json` وتُستورد إلى `server_configs(guild_id, 'ticket')` عبر `db/seed/import_server_configs.ts`. عند تشغيل بوت تكتات لهذا السيرفر سيجلب هذه الإعدادات تلقائياً.
