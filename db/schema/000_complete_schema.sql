-- ════════════════════════════════════════════════════════════════════════════
-- Opus Solutions — السكيمة الكاملة الموحّدة (شغّل هذا الملف وحده)
--
-- يحلّ كل أخطاء ترتيب التشغيل: كل الجداول والدوال بالترتيب الصحيح للتبعيات،
-- وكلها idempotent (create if not exists / create or replace) — آمن تكراره.
--
-- الترتيب: pgcrypto → accounts → guilds → server_configs → service_events
--          → token_pool (+claim/release) → bot_instances → subscriptions
--          → provision_instance → products/plans → payments/events.
--
-- بعد تشغيله شغّل ملفات db/seed/*.sql.
-- ════════════════════════════════════════════════════════════════════════════

create extension if not exists "pgcrypto";

-- ── 1) الحسابات (الربط الإجباري قبل الشراء) ──
create table if not exists accounts (
  id               uuid primary key default gen_random_uuid(),
  discord_user_id  text not null unique,
  discord_username text,
  email            text,
  avatar_url       text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  last_login_at    timestamptz
);

-- ── 2) السيرفرات (سجل + ربط المالك) ── يُستخدم في seeds
create table if not exists guilds (
  id                    text primary key,
  owner_account_id      uuid references accounts(id) on delete set null,
  owner_discord_user_id text,
  name                  text,
  icon_url              text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

-- ── 3) إعدادات كل (سيرفر × منتج): تبقى للأبد حتى لو توقف البوت ──
create table if not exists server_configs (
  id           uuid primary key default gen_random_uuid(),
  guild_id     text not null,
  product_type text not null check (product_type in ('ticket','voice_rooms','general','broadcast')),
  config_data  jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (guild_id, product_type)
);

-- ── 4) سجل الأحداث ──
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

-- ── migrations: أضف الأعمدة الجديدة للجداول الموجودة مسبقاً ──
alter table service_events   add column if not exists instance_id  uuid;
alter table service_events   add column if not exists account_id   uuid references accounts(id) on delete set null;
alter table service_events   add column if not exists guild_id     text;
alter table service_events   add column if not exists user_id      text;
alter table service_events   add column if not exists metadata     jsonb not null default '{}'::jsonb;

alter table bot_instances    add column if not exists token_id           uuid references token_pool(id);
alter table bot_instances    add column if not exists bot_application_id text;
alter table bot_instances    add column if not exists bot_user_id        text;
alter table bot_instances    add column if not exists bot_name           text;
alter table bot_instances    add column if not exists guild_name         text;
alter table bot_instances    add column if not exists account_id         uuid references accounts(id) on delete set null;
alter table bot_instances    add column if not exists plan_type          text not null default 'paid';
alter table bot_instances    add column if not exists started_at         timestamptz;
alter table bot_instances    add column if not exists last_started_at    timestamptz;
alter table bot_instances    add column if not exists last_stopped_at    timestamptz;

alter table subscriptions    add column if not exists account_id   uuid references accounts(id) on delete set null;
alter table subscriptions    add column if not exists instance_id  uuid references bot_instances(id) on delete set null;
alter table subscriptions    add column if not exists external_ref text;

alter table token_pool       add column if not exists claimed_by_instance_id uuid;
alter table token_pool       add column if not exists claimed_at             timestamptz;
alter table token_pool       add column if not exists label                  text;

alter table guilds           add column if not exists owner_account_id      uuid references accounts(id) on delete set null;
alter table guilds           add column if not exists owner_discord_user_id text;
alter table guilds           add column if not exists icon_url              text;

create index if not exists idx_server_configs_guild on server_configs(guild_id);
create index if not exists idx_service_events_instance on service_events(instance_id);
create index if not exists idx_service_events_created on service_events(created_at desc);

-- ── 5) بركة التوكنات (مشفّرة) ──
create table if not exists token_pool (
  id                     uuid primary key default gen_random_uuid(),
  product_type           text not null check (product_type in ('ticket','voice_rooms','general','broadcast')),
  bot_application_id     text not null,
  bot_token_encrypted    text not null,
  status                 text not null default 'available'
                           check (status in ('available','claimed','disabled')),
  claimed_by_instance_id uuid,
  claimed_at             timestamptz,
  label                  text,
  reserved_for_discord_id text,                        -- حجز خاص: هذا التوكن لزبون معيّن فقط (NULL = بركة عامة)
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  unique (bot_application_id)
);

-- ترقية الجداول القائمة (آمن لإعادة التشغيل):
alter table token_pool add column if not exists reserved_for_discord_id text;

create unique index if not exists uq_token_pool_one_claim_per_instance
  on token_pool(claimed_by_instance_id)
  where claimed_by_instance_id is not null;

create index if not exists idx_token_pool_available
  on token_pool(product_type, created_at)
  where status = 'available';

-- تسريع البحث عن توكن محجوز لزبون معيّن:
create index if not exists idx_token_pool_reserved
  on token_pool(reserved_for_discord_id, product_type)
  where reserved_for_discord_id is not null and status = 'available';

-- ── 6) نسخ البوتات المُشغّلة ──
create table if not exists bot_instances (
  id                 uuid primary key default gen_random_uuid(),
  product_type       text not null check (product_type in ('ticket','voice_rooms','general','broadcast')),
  token_id           uuid references token_pool(id),
  bot_application_id text,
  bot_user_id        text,
  bot_name           text,
  bot_avatar_url     text,                              -- صورة البوت (يحدّثها الزبون)
  bot_banner_url     text,                              -- بنر البوت (يحدّثها الزبون)
  guild_id           text not null,
  guild_name         text,
  owner_id           text not null,
  account_id         uuid references accounts(id) on delete set null,
  plan_type          text not null default 'paid' check (plan_type in ('trial','paid')),
  status             text not null default 'active'
                       check (status in ('active','expired','cancelled','paused','rejected')),
  started_at         timestamptz,
  expires_at         timestamptz,
  last_started_at    timestamptz,
  last_stopped_at    timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

-- ترقية الجداول القائمة (آمن لإعادة التشغيل):
alter table bot_instances add column if not exists bot_avatar_url text;
alter table bot_instances add column if not exists bot_banner_url text;

create unique index if not exists uq_active_instance_per_guild_product
  on bot_instances(guild_id, product_type)
  where status = 'active';
create index if not exists idx_bot_instances_status on bot_instances(status, product_type);
create index if not exists idx_bot_instances_owner on bot_instances(owner_id);
create index if not exists idx_bot_instances_account on bot_instances(account_id);

-- FK: التوكن المحجوز ← النسخة (بعد إنشاء bot_instances)
alter table token_pool drop constraint if exists fk_token_claimed_instance;
alter table token_pool
  add constraint fk_token_claimed_instance
  foreign key (claimed_by_instance_id) references bot_instances(id) on delete set null;

-- ── 7) الاشتراكات ──
create table if not exists subscriptions (
  id           uuid primary key default gen_random_uuid(),
  account_id   uuid references accounts(id) on delete set null,
  owner_id     text not null,
  guild_id     text not null,
  product_type text not null check (product_type in ('ticket','voice_rooms','general','broadcast')),
  instance_id  uuid references bot_instances(id) on delete set null,
  plan_name    text not null default 'monthly',
  status       text not null default 'active'
                 check (status in ('active','expired','cancelled','paused','rejected')),
  starts_at    timestamptz not null default now(),
  expires_at   timestamptz not null,
  external_ref text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists idx_subscriptions_status on subscriptions(status);
create index if not exists idx_subscriptions_expires on subscriptions(expires_at);
create unique index if not exists uq_subscription_external_ref
  on subscriptions(external_ref) where external_ref is not null;

-- ── 8) دوال بركة التوكنات (الذرّية) ──
-- p_owner_id (اختياري): إن وُجد توكن محجوز لهذا الزبون لنفس المنتج، يُسحب أولاً.
-- وإلا يُسحب من البركة العامة مع استثناء كل التوكنات المحجوزة لزبائن آخرين.
create or replace function claim_token(
  p_product_type text,
  p_instance_id  uuid,
  p_owner_id     text default null
)
returns token_pool
language plpgsql
as $$
declare
  v_token token_pool;
begin
  -- 1) أولوية: توكن محجوز لهذا الزبون بالذات (بوته الموجود مسبقاً)
  if p_owner_id is not null then
    select * into v_token
      from token_pool
     where product_type = p_product_type and status = 'available'
       and reserved_for_discord_id = p_owner_id
     order by created_at
     for update skip locked
     limit 1;
  end if;

  -- 2) وإلا: البركة العامة فقط (لا يُمسّ أي توكن محجوز لغيره)
  if v_token.id is null then
    select * into v_token
      from token_pool
     where product_type = p_product_type and status = 'available'
       and reserved_for_discord_id is null
     order by created_at
     for update skip locked
     limit 1;
  end if;

  if v_token.id is null then
    return null;
  end if;

  update token_pool
     set status = 'claimed', claimed_by_instance_id = p_instance_id,
         claimed_at = now(), updated_at = now()
   where id = v_token.id
  returning * into v_token;
  return v_token;
end;
$$;

create or replace function release_token(p_instance_id uuid)
returns void
language plpgsql
as $$
begin
  update token_pool
     set status = 'available', claimed_by_instance_id = null,
         claimed_at = null, updated_at = now()
   where claimed_by_instance_id = p_instance_id;
end;
$$;

-- المخزون العام فقط (يستثني التوكنات المحجوزة لزبائن) — للعرض العام وفحص الزبون العادي.
create or replace function available_token_count(p_product_type text)
returns integer
language sql stable
as $$
  select count(*)::int from token_pool
   where product_type = p_product_type and status = 'available'
     and reserved_for_discord_id is null;
$$;

-- المخزون المتاح لزبون معيّن = العام + المحجوز له خصيصاً.
create or replace function available_token_count_for(p_product_type text, p_owner_id text)
returns integer
language sql stable
as $$
  select count(*)::int from token_pool
   where product_type = p_product_type and status = 'available'
     and (reserved_for_discord_id is null or reserved_for_discord_id = p_owner_id);
$$;

-- ── 9) التفعيل الذرّي ──
create or replace function provision_instance(
  p_account_id uuid, p_owner_id text, p_guild_id text, p_guild_name text,
  p_product_type text, p_plan_name text, p_duration_days int, p_external_ref text
)
returns bot_instances
language plpgsql
as $$
declare
  v_instance bot_instances;
  v_token    token_pool;
begin
  select * into v_instance
    from bot_instances
   where guild_id = p_guild_id and product_type = p_product_type
   order by created_at desc
   limit 1;

  if found then
    update bot_instances
       set status = 'active',
           owner_id = p_owner_id,                       -- المشتري الدافع يملك النسخة (يراها في لوحته)
           account_id = coalesce(p_account_id, account_id),
           guild_name = coalesce(p_guild_name, guild_name),
           expires_at = now() + make_interval(days => p_duration_days),
           updated_at = now()
     where id = v_instance.id
    returning * into v_instance;

    if v_instance.token_id is null then
      v_token := claim_token(p_product_type, v_instance.id, p_owner_id);
      if v_token.id is null then
        raise exception 'NO_TOKEN_AVAILABLE';
      end if;
      update bot_instances
         set token_id = v_token.id, bot_application_id = v_token.bot_application_id
       where id = v_instance.id
      returning * into v_instance;
    end if;
  else
    -- insert with placeholders for the NOT NULL columns, then backfill from the
    -- claimed token (claim must happen after insert: token_pool.claimed_by_instance_id
    -- has an FK to bot_instances.id).
    insert into bot_instances (product_type, guild_id, guild_name, owner_id, account_id,
                               bot_name, bot_token_encrypted,
                               plan_type, status, started_at, expires_at)
    values (p_product_type, p_guild_id, p_guild_name, p_owner_id, p_account_id,
            'Bot', '',
            'paid', 'active', now(), now() + make_interval(days => p_duration_days))
    returning * into v_instance;

    v_token := claim_token(p_product_type, v_instance.id, p_owner_id);
    if v_token.id is null then
      raise exception 'NO_TOKEN_AVAILABLE';
    end if;

    update bot_instances
       set token_id = v_token.id,
           bot_application_id = v_token.bot_application_id,
           bot_name = coalesce(v_token.label, 'Bot'),
           bot_token_encrypted = v_token.bot_token_encrypted
     where id = v_instance.id
    returning * into v_instance;
  end if;

  insert into subscriptions (account_id, user_id, owner_id, guild_id, product_type, instance_id,
                             plan_name, status, starts_at, expires_at, external_ref)
  values (p_account_id, p_owner_id, p_owner_id, p_guild_id, p_product_type, v_instance.id,
          p_plan_name, 'active', now(), v_instance.expires_at, p_external_ref)
  on conflict (external_ref) where external_ref is not null
  do update set status = 'active', expires_at = excluded.expires_at, updated_at = now();

  return v_instance;
end;
$$;

-- ── 10) المنتجات والباقات (التجارة) ──
create table if not exists products (
  id text primary key,
  product_type text unique check (product_type in ('ticket','voice_rooms','general','broadcast')),
  name text not null,
  description text not null,
  is_custom boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists plans (
  id text primary key,
  product_id text references products(id) on delete cascade,
  name text not null,
  interval text not null check (interval in ('monthly','quarterly','yearly','custom')),
  duration_days int not null check (duration_days > 0),
  amount_cents int not null check (amount_cents >= 0),
  currency text not null default 'USD',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists product_configs (
  id uuid primary key default gen_random_uuid(),
  product_type text not null check (product_type in ('ticket','voice_rooms','general','broadcast')),
  key text not null,
  value jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(product_type, key)
);

create table if not exists feature_flags (
  id uuid primary key default gen_random_uuid(),
  product_type text check (product_type in ('ticket','voice_rooms','general','broadcast')),
  key text not null,
  enabled boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(product_type, key)
);

-- ترقية القيود القديمة (آمن لإعادة التشغيل): يضمن أن قيد product_type على كل
-- جدول يطابق القيم الحالية حتى لو الجدول كان موجوداً من قبل بقيد قديم مختلف.
alter table server_configs  drop constraint if exists server_configs_product_type_check;
alter table server_configs  add constraint server_configs_product_type_check
  check (product_type in ('ticket','voice_rooms','general','broadcast'));

alter table token_pool      drop constraint if exists token_pool_product_type_check;
alter table token_pool      add constraint token_pool_product_type_check
  check (product_type in ('ticket','voice_rooms','general','broadcast'));

alter table bot_instances   drop constraint if exists bot_instances_product_type_check;
alter table bot_instances   add constraint bot_instances_product_type_check
  check (product_type in ('ticket','voice_rooms','general','broadcast'));

alter table subscriptions   drop constraint if exists subscriptions_product_type_check;
alter table subscriptions   add constraint subscriptions_product_type_check
  check (product_type in ('ticket','voice_rooms','general','broadcast'));

alter table products        drop constraint if exists products_product_type_check;
alter table products        add constraint products_product_type_check
  check (product_type in ('ticket','voice_rooms','general','broadcast'));

alter table product_configs drop constraint if exists product_configs_product_type_check;
alter table product_configs add constraint product_configs_product_type_check
  check (product_type in ('ticket','voice_rooms','general','broadcast'));

alter table feature_flags   drop constraint if exists feature_flags_product_type_check;
alter table feature_flags   add constraint feature_flags_product_type_check
  check (product_type in ('ticket','voice_rooms','general','broadcast'));

create table if not exists payments (
  id uuid primary key default gen_random_uuid(),
  account_id uuid references accounts(id) on delete set null,
  subscription_id uuid references subscriptions(id) on delete set null,
  product_id text references products(id),
  plan_id text references plans(id),
  paypal_order_id text unique,
  paypal_capture_id text,
  status text not null check (status in ('created','approved','captured','failed','refunded','cancelled')),
  amount_cents int not null,
  currency text not null default 'USD',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists payment_events (
  id bigserial primary key,
  payment_id uuid references payments(id) on delete set null,
  provider text not null default 'paypal',
  event_type text not null,
  external_event_id text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_payments_account on payments(account_id);
create index if not exists idx_payment_events_external on payment_events(external_event_id);

-- بيانات المنتجات والباقات الأساسية
insert into products (id, product_type, name, description, is_custom) values
  ('ticket-bot','ticket','Ticket Bot','Advanced Discord ticketing, panels, transcripts, mediators and escalation.', false),
  ('voice-rooms-bot','voice_rooms','TempRooms Bot','Join-to-create temporary voice rooms with owner control panel.', false),
  ('general-system-bot','general','General/System Bot','Moderation, logs, levels, economy and utility systems.', false),
  ('broadcast-bot','broadcast','Broadcast Bot','DM a message to all server members or a specific role, with a live progress bar.', false),
  ('custom-bot', null, 'Custom Bot','A bespoke Discord bot built with the developers for your idea.', true)
on conflict (id) do update set name = excluded.name, description = excluded.description, is_custom = excluded.is_custom;

insert into plans (id, product_id, name, interval, duration_days, amount_cents, currency) values
  ('ticket-monthly','ticket-bot','Monthly','monthly',30,999,'USD'),
  ('ticket-quarterly','ticket-bot','Quarterly','quarterly',90,2799,'USD'),
  ('voice-rooms-monthly','voice-rooms-bot','Monthly','monthly',30,799,'USD'),
  ('voice-rooms-quarterly','voice-rooms-bot','Quarterly','quarterly',90,2199,'USD'),
  ('general-monthly','general-system-bot','Monthly','monthly',30,1299,'USD'),
  ('general-quarterly','general-system-bot','Quarterly','quarterly',90,3599,'USD'),
  ('broadcast-monthly','broadcast-bot','Monthly','monthly',30,300,'USD'),
  ('broadcast-quarterly','broadcast-bot','Quarterly','quarterly',90,900,'USD')
on conflict (id) do update set amount_cents = excluded.amount_cents, duration_days = excluded.duration_days;

-- ════════════════════════════════════════════════════════════════
-- 11) تحليلات الموقع (Status) — تجميع دقيق في SQL (بلا سقف صفوف)
-- plpgsql لتأجيل التحقق: website_logs/website_events تُطبَّق من product-schemas.
-- يُستدعى من لوحة المالك فقط (analytics-data.ts).
-- ════════════════════════════════════════════════════════════════
create or replace function get_site_status()
returns jsonb
language plpgsql
stable
as $$
declare
  result jsonb;
begin
  select jsonb_build_object(
    'traffic', jsonb_build_object(
      'visits24h',   (select count(*) from website_logs where created_at >= now() - interval '24 hours'),
      'visits7d',    (select count(*) from website_logs where created_at >= now() - interval '7 days'),
      'visits30d',   (select count(*) from website_logs where created_at >= now() - interval '30 days'),
      'visitsTotal', (select count(*) from website_logs),
      'unique7d',    (select count(distinct ip_anonymized) from website_logs where created_at >= now() - interval '7 days'),
      'unique30d',   (select count(distinct ip_anonymized) from website_logs where created_at >= now() - interval '30 days')
    ),
    'visitsByDay', (
      select coalesce(jsonb_agg(jsonb_build_object('date', to_char(d.day,'YYYY-MM-DD'), 'count', coalesce(c.cnt,0)) order by d.day), '[]')
      from generate_series((current_date - interval '13 days')::date, current_date, interval '1 day') as d(day)
      left join (
        select created_at::date as day, count(*) cnt from website_logs
        where created_at >= current_date - interval '13 days' group by 1
      ) c on c.day = d.day::date
    ),
    'topPages', (
      select coalesce(jsonb_agg(jsonb_build_object('path', path, 'count', cnt) order by cnt desc), '[]')
      from (select path, count(*) cnt from website_logs where created_at >= now() - interval '30 days' group by path order by cnt desc limit 8) p
    ),
    'devices', jsonb_build_object(
      'desktop', (select count(*) from website_logs where created_at >= now() - interval '30 days' and device_type='desktop'),
      'mobile',  (select count(*) from website_logs where created_at >= now() - interval '30 days' and device_type='mobile'),
      'tablet',  (select count(*) from website_logs where created_at >= now() - interval '30 days' and device_type='tablet')
    ),
    'topReferers', (
      select coalesce(jsonb_agg(jsonb_build_object('referer', referer, 'count', cnt) order by cnt desc), '[]')
      from (select referer, count(*) cnt from website_logs where created_at >= now() - interval '30 days' and referer is not null and referer <> '' group by referer order by cnt desc limit 5) r
    ),
    'funnel', jsonb_build_object(
      'visitors',      (select count(distinct ip_anonymized) from website_logs where created_at >= now() - interval '30 days'),
      'viewedPricing', (select count(distinct ip_anonymized) from website_logs where created_at >= now() - interval '30 days' and (path like '/pricing%' or path like '/product%')),
      'reachedCart',   (select count(distinct ip_anonymized) from website_logs where created_at >= now() - interval '30 days' and path like '/cart%'),
      'loggedIn',      (select count(distinct ip_anonymized) from website_logs where created_at >= now() - interval '30 days' and path like '/dashboard%'),
      'purchases',     (select count(*) from payments where status='captured' and created_at >= now() - interval '30 days')
    ),
    'events30d', jsonb_build_object(
      'orderCreated',    (select count(*) from website_events where created_at >= now() - interval '30 days' and event_type='order_created'),
      'purchaseSuccess', (select count(*) from website_events where created_at >= now() - interval '30 days' and event_type='purchase_success'),
      'captureError',    (select count(*) from website_events where created_at >= now() - interval '30 days' and event_type in ('capture_error','order_create_error')),
      'pending',         (select count(*) from website_events where created_at >= now() - interval '30 days' and event_type='provision_pending')
    ),
    'recentEvents', (
      select coalesce(jsonb_agg(jsonb_build_object('type', event_type, 'at', created_at) order by created_at desc), '[]')
      from (select event_type, created_at from website_events order by created_at desc limit 15) e
    )
  ) into result;
  return result;
end;
$$;

-- ════════════════════════════════════════════════════════════════
-- 12) إعداد الويلكم لبوت السيستم (يحرّره العميل من الموقع، يقرؤه البوت)
-- جسر الإعدادات: الموقع يكتب هنا، وبوت system يقرأ منه في guildMemberAdd.
-- ════════════════════════════════════════════════════════════════
create table if not exists guild_welcome (
  guild_id      text primary key,
  enabled       boolean not null default false,
  channel_id    text,
  message       text,
  ping_user     boolean not null default true,
  image_enabled boolean not null default false,
  image_config  jsonb   not null default '{}'::jsonb,   -- للوحدة 2 (صورة الويلكم)
  updated_at    timestamptz not null default now()
);

-- ════════════════════════════════════════════════════════════════
-- 13) اختصارات الأوامر (بوت السيستم) — كلمة عربية مخصّصة لكل سيرفر
-- تشغّل نفس منطق أمر سلاش موجود (مثل "باند" => /ban) عبر رسالة عادية.
-- ════════════════════════════════════════════════════════════════
create table if not exists guild_command_aliases (
  id           uuid primary key default gen_random_uuid(),
  guild_id     text not null,
  alias        text not null,
  command_name text not null,
  created_at   timestamptz not null default now(),
  unique (guild_id, alias)
);

create index if not exists idx_guild_command_aliases_guild on guild_command_aliases(guild_id);

-- ════════════════════════════════════════════════════════════════
-- إعدادات صلاحيات أوامر السيستم من الداشبورد: تفعيل/تعطيل الأمر،
-- والسماح لرتب أو أشخاص محددين بدون الاعتماد على جداول legacy.
-- ════════════════════════════════════════════════════════════════
create table if not exists guild_command_settings (
  guild_id         text not null,
  command_name     text not null,
  enabled          boolean not null default true,
  allowed_role_ids jsonb not null default '[]'::jsonb,
  allowed_user_ids jsonb not null default '[]'::jsonb,
  updated_at       timestamptz not null default now(),
  primary key (guild_id, command_name)
);

create index if not exists idx_guild_command_settings_guild on guild_command_settings(guild_id);

-- ════════════════════════════════════════════════════════════════
-- نظام السجن لبوت السيستم: الإعدادات الأساسية تبقى داخل server_configs
-- config_data.jail، وهذه الجداول تحفظ التفويضات والسجناء وسجل التدقيق.
-- ════════════════════════════════════════════════════════════════
create table if not exists guild_jail_delegates (
  id            uuid primary key default gen_random_uuid(),
  guild_id      text not null,
  user_id       text not null,
  granted_by_id text not null,
  revoked_by_id text,
  revoked_at    timestamptz,
  created_at    timestamptz not null default now()
);

create unique index if not exists uq_guild_jail_delegates_active
  on guild_jail_delegates(guild_id, user_id)
  where revoked_at is null;
create index if not exists idx_guild_jail_delegates_guild on guild_jail_delegates(guild_id, created_at desc);

create table if not exists guild_jail_prisoners (
  id                uuid primary key default gen_random_uuid(),
  guild_id          text not null,
  user_id           text not null,
  jailed_by_id      text not null,
  jail_role_id      text,
  original_role_ids jsonb not null default '[]'::jsonb,
  reason            text,
  started_at        timestamptz not null default now(),
  expires_at        timestamptz not null,
  released_at       timestamptz,
  released_by_id    text,
  release_kind      text,
  release_reason    text,
  skipped_role_ids  jsonb not null default '[]'::jsonb
);

create unique index if not exists uq_guild_jail_prisoners_active
  on guild_jail_prisoners(guild_id, user_id)
  where released_at is null;
create index if not exists idx_guild_jail_prisoners_due on guild_jail_prisoners(expires_at) where released_at is null;
create index if not exists idx_guild_jail_prisoners_guild on guild_jail_prisoners(guild_id, started_at desc);

create table if not exists guild_jail_audit (
  id             bigserial primary key,
  guild_id       text not null,
  actor_id       text,
  target_user_id text,
  action         text not null,
  reason         text,
  metadata       jsonb not null default '{}'::jsonb,
  created_at     timestamptz not null default now()
);

create index if not exists idx_guild_jail_audit_guild on guild_jail_audit(guild_id, created_at desc);
create index if not exists idx_guild_jail_audit_target on guild_jail_audit(guild_id, target_user_id, created_at desc);

-- تحذيرات الأعضاء التي ينشئها /warn ويعرضها /warnings.
create table if not exists guild_warnings (
  id           uuid primary key default gen_random_uuid(),
  guild_id     text not null,
  user_id      text not null,
  moderator_id text not null,
  reason       text not null,
  created_at   timestamptz not null default now()
);

create index if not exists idx_guild_warnings_member on guild_warnings(guild_id, user_id, created_at desc);

-- جداول توافق بوت السيستم legacy: الإعدادات، الاقتصاد، XP/levels.
-- بدونها تظهر أخطاء مثل: public.members not found in schema cache.
alter table guilds add column if not exists prefix text not null default '!';
alter table guilds add column if not exists language text not null default 'en';
alter table guilds add column if not exists embed_color text not null default '5865F2';
alter table guilds add column if not exists owner_id text;

create table if not exists guild_channels (
  guild_id                text primary key,
  welcome_channel         text,
  leave_channel           text,
  logs_channel            text,
  message_logs_channel    text,
  voice_logs_channel      text,
  join_leave_logs_channel text,
  updated_at              timestamptz not null default now()
);

create table if not exists guild_roles (
  guild_id   text primary key,
  auto_role  text,
  mute_role  text,
  mod_role   text,
  admin_role text,
  updated_at timestamptz not null default now()
);

create table if not exists guild_modules (
  guild_id          text primary key,
  welcome_enabled   boolean not null default true,
  leave_enabled     boolean not null default true,
  logging_enabled   boolean not null default true,
  antiraid_enabled  boolean not null default false,
  automod_enabled   boolean not null default false,
  antilinks_enabled boolean not null default false,
  antispam_enabled  boolean not null default false,
  antibots_enabled  boolean not null default false,
  antiswear_enabled boolean not null default false,
  updated_at        timestamptz not null default now()
);

create table if not exists users (
  id         text primary key,
  username   text,
  credits    integer not null default 0,
  global_xp  integer not null default 0,
  last_daily timestamptz,
  rep        integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists members (
  guild_id   text not null,
  user_id    text not null references users(id) on delete cascade,
  xp         integer not null default 0,
  level      integer not null default 1,
  warnings   integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (guild_id, user_id)
);

create index if not exists idx_members_guild_xp on members(guild_id, xp desc);
create index if not exists idx_members_user on members(user_id);

-- ════════════════════════════════════════════════════════════════
-- 14) تخزين صور الترحيب (الخلفية اللي يرفعها العميل) — Bucket عام
-- للقراءة، الكتابة فقط عبر service role (الموقع).
-- ════════════════════════════════════════════════════════════════
insert into storage.buckets (id, name, public)
values ('welcome-images', 'welcome-images', true)
on conflict (id) do nothing;


-- ════════════════════════════════════════════════════════════════
-- 15) Encrypted custom-project requests and private conversations
-- ════════════════════════════════════════════════════════════════
-- Encrypted custom-project requests and private owner/customer conversations.
-- Apply once in Supabase before deploying the website feature.

create extension if not exists pgcrypto;

create table if not exists public.project_requests (
  id uuid primary key default gen_random_uuid(),
  requester_hash text not null,
  requester_discord_id_enc text not null,
  requester_name_enc text,
  phone_enc text,
  status text not null default 'new' check (status in ('new', 'open', 'closed')),
  owner_unread boolean not null default true,
  customer_unread boolean not null default false,
  created_at timestamptz not null default now(),
  last_message_at timestamptz not null default now()
);

create table if not exists public.project_request_messages (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.project_requests(id) on delete cascade,
  sender_type text not null check (sender_type in ('customer', 'owner')),
  content_enc text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_project_requests_requester_hash
  on public.project_requests(requester_hash, last_message_at desc);
create index if not exists idx_project_requests_owner_inbox
  on public.project_requests(owner_unread, last_message_at desc);
create index if not exists idx_project_request_messages_thread
  on public.project_request_messages(request_id, created_at asc);

alter table public.project_requests enable row level security;
alter table public.project_request_messages enable row level security;

-- The Next.js server uses the Supabase service role. Browser roles receive no direct access.
revoke all on table public.project_requests from anon, authenticated;
revoke all on table public.project_request_messages from anon, authenticated;
