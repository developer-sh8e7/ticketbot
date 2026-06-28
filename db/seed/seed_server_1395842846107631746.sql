-- ════════════════════════════════════════════════════════════════
-- Seed: سيرفر المتجر الرسمي 1395842846107631746
-- هذا السيرفر مستثنى تماماً من نظام الاشتراكات (يعمل دائماً).
-- الاستثناء مطبّق في الكود عبر EXEMPT_GUILD_IDS في @opus/core:
--   - provisioning: لا ربط حساب إجباري + مدة لا تنتهي.
--   - manager.expireStale: لا يُنهي سيرفر المتجر أبداً.
--   - web/capture-order: لا يُزوّد عبر الشراء.
-- شغّله بعد ترحيلات الـ schema.
-- ════════════════════════════════════════════════════════════════

insert into guilds (id, name) values ('1395842846107631746', 'Opus Store (Exempt)')
on conflict (id) do nothing;

-- إعدادات المتجر — تُحمّل من config_1395842846107631746.json.
-- psql مثال (يقرأ الملف مباشرة):
-- \set store_json `cat db/seed/config_1395842846107631746.json`
-- insert into server_configs (guild_id, product_type, config_data)
-- values ('1395842846107631746', 'ticket',      :'store_json'::jsonb),
--        ('1395842846107631746', 'voice_rooms', :'store_json'::jsonb),
--        ('1395842846107631746', 'general',     :'store_json'::jsonb)
-- on conflict (guild_id, product_type) do update
--   set config_data = excluded.config_data, updated_at = now();

-- نسخ بوت دائمة للمتجر (تعمل بلا اشتراك ولا انتهاء).
-- لكل منتج: أنشئ نسخة active بـ expires_at = null ثم احجز لها توكناً من البركة.
-- expires_at = null يعني أن manager.expireStale لن يلمسها أبداً.
--
-- do $$
-- declare v_id uuid; v_tok token_pool;
-- begin
--   foreach in array['ticket','voice_rooms','general'] loop ... end loop; -- نفّذ يدوياً لكل منتج:
--
--   insert into bot_instances (product_type, guild_id, guild_name, owner_id, plan_type, status, started_at, expires_at)
--   values ('ticket','1395842846107631746','Opus Store','1397364822152315052','paid','active', now(), null)
--   returning id into v_id;
--   v_tok := claim_token('ticket', v_id);
--   update bot_instances set token_id = v_tok.id, bot_application_id = v_tok.bot_application_id where id = v_id;
-- end $$;
--
-- كرّر الكتلة أعلاه لـ 'voice_rooms' و'general' حسب البوتات التي تريد تشغيلها للمتجر.
