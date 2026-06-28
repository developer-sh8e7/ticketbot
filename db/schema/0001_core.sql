-- ════════════════════════════════════════════════════════════════
-- Opus Solutions — 0001_core
-- الحسابات (الربط الإجباري) + إعدادات السيرفرات المحفوظة + سجل الأحداث
-- ════════════════════════════════════════════════════════════════

create extension if not exists "pgcrypto";

-- ── الحسابات: لا يمكن الشراء إلا بربط حساب أولاً ──
-- يُنشأ الحساب عند تسجيل الدخول عبر Discord OAuth في الموقع.
create table if not exists accounts (
  id              uuid primary key default gen_random_uuid(),
  discord_user_id text not null unique,         -- هوية ديسكورد المربوطة
  discord_username text,
  email           text,
  avatar_url      text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  last_login_at   timestamptz
);

-- ── إعدادات كل (سيرفر × منتج): تبقى للأبد حتى لو توقف البوت ──
-- عند التجديد، يجلب البوت إعداداته من هنا فيرجع كأنه ما وقف.
create table if not exists server_configs (
  id           uuid primary key default gen_random_uuid(),
  guild_id     text not null,
  product_type text not null check (product_type in ('ticket','voice_rooms','general')),
  config_data  jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (guild_id, product_type)
);

-- ── سجل كل ما يحدث في النظام (تدقيق/مراقبة) ──
create table if not exists service_events (
  id            bigserial primary key,
  instance_id   uuid,
  account_id    uuid references accounts(id) on delete set null,
  guild_id      text,
  user_id       text,
  event_type    text not null,
  event_message text not null,
  metadata      jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now()
);

create index if not exists idx_server_configs_guild on server_configs(guild_id);
create index if not exists idx_service_events_instance on service_events(instance_id);
create index if not exists idx_service_events_created on service_events(created_at desc);
