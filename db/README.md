# قاعدة البيانات (Supabase / Postgres)

## تطبيق السكيمة

طبّق الملف الموحّد في محرر SQL في Supabase (أو عبر `psql`):

```
db/schema/000_complete_schema.sql          -- كل شيء: accounts, server_configs, token_pool
                                           -- + claim_token/release_token (السحب الذرّي)
                                           -- + bot_instances, subscriptions, provision_instance
                                           -- + products, plans, payments
```

> ملف واحد يجمع كل السكيمة بالترتيب الصحيح (آمن لإعادة التشغيل — `create ... if not exists` / `create or replace`).

## تعبئة بركة التوكنات

لا تُدرج التوكنات نصاً. استخدم `TokenPoolRepository.addToken()` (يشفّر تلقائياً) أو سكربت إدارة يستدعيها. مثال مفهومي:

```ts
await tokenPool.addToken({
  productType: 'ticket',
  botApplicationId: '123...',
  plainToken: 'MTx...the-bot-token',   // يُشفّر قبل التخزين
  label: 'ticket-pool #1',
});
```

كرّرها لكل توكن من الـ20 لكل منتج.

## استيراد إعدادات السيرفر الخاص

```bash
pnpm tsx db/seed/import_server_configs.ts
```

يرفع `config_1413059459630104626.json` إلى `server_configs(guild_id, 'ticket')`.

## التحقق من الذرّية (اختبار)

افتح اتصالين متزامنين ونفّذ `select claim_token('ticket', gen_random_uuid())` في كليهما داخل معاملات متوازية — يجب أن يحصل كل اتصال على توكن مختلف (أو NULL عند النفاد)، ولا يتكرر التوكن أبداً.
