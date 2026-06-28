-- ════════════════════════════════════════════════════════════════
-- Opus Solutions — 0003_instances_subscriptions
-- نسخ البوتات المُشغّلة + الاشتراكات ودورة حياتها
-- ════════════════════════════════════════════════════════════════

-- ── نسخة بوت مُشغّلة لزبون ──
create table if not exists bot_instances (
  id                 uuid primary key default gen_random_uuid(),
  product_type       text not null check (product_type in ('ticket','voice_rooms','general')),
  token_id           uuid references token_pool(id),
  bot_application_id text,
  bot_user_id        text,
  bot_name           text,
  guild_id           text not null,
  guild_name         text,
  owner_id           text not null,                        -- صاحب الاشتراك (Discord ID)
  account_id         uuid references accounts(id) on delete set null,  -- الربط الإجباري
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

-- نسخة فعّالة واحدة فقط لكل (سيرفر × منتج):
create unique index if not exists uq_active_instance_per_guild_product
  on bot_instances(guild_id, product_type)
  where status = 'active';

create index if not exists idx_bot_instances_status on bot_instances(status, product_type);
create index if not exists idx_bot_instances_owner on bot_instances(owner_id);
create index if not exists idx_bot_instances_account on bot_instances(account_id);

-- ربط مرجعي للتوكن المحجوز ← النسخة (يكمل الفهرس الفريد في 0002):
alter table token_pool
  drop constraint if exists fk_token_claimed_instance;
alter table token_pool
  add constraint fk_token_claimed_instance
  foreign key (claimed_by_instance_id) references bot_instances(id) on delete set null;

-- ── الاشتراكات ──
create table if not exists subscriptions (
  id           uuid primary key default gen_random_uuid(),
  account_id   uuid references accounts(id) on delete set null,
  owner_id     text not null,
  guild_id     text not null,
  product_type text not null check (product_type in ('ticket','voice_rooms','general')),
  instance_id  uuid references bot_instances(id) on delete set null,
  plan_name    text not null default 'monthly',
  status       text not null default 'active'
                 check (status in ('active','expired','cancelled','paused','rejected')),
  starts_at    timestamptz not null default now(),
  expires_at   timestamptz not null,
  external_ref text,                                   -- PayPal subscription/order ID
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists idx_subscriptions_status on subscriptions(status);
create index if not exists idx_subscriptions_expires on subscriptions(expires_at);
create unique index if not exists uq_subscription_external_ref
  on subscriptions(external_ref) where external_ref is not null;

-- ════════════════════════════════════════════════════════════════
-- provision_instance(): تفعيل ذرّي كامل عند الشراء.
-- داخل معاملة واحدة: تأكد من الربط → اسحب توكن → أنشئ النسخة → اربط الاشتراك.
-- إن لم يتوفر توكن، تُرجع NULL ولا يحدث أي تغيير جزئي.
-- ════════════════════════════════════════════════════════════════
create or replace function provision_instance(
  p_account_id   uuid,
  p_owner_id     text,
  p_guild_id     text,
  p_guild_name   text,
  p_product_type text,
  p_plan_name    text,
  p_duration_days int,
  p_external_ref text
)
returns bot_instances
language plpgsql
as $$
declare
  v_instance bot_instances;
  v_token    token_pool;
begin
  -- 1) إعادة تفعيل نسخة موجودة (تجديد) إن وُجدت لنفس السيرفر والمنتج
  select * into v_instance
    from bot_instances
   where guild_id = p_guild_id and product_type = p_product_type
   order by created_at desc
   limit 1;

  if found then
    update bot_instances
       set status = 'active',
           account_id = coalesce(p_account_id, account_id),
           expires_at = now() + make_interval(days => p_duration_days),
           updated_at = now()
     where id = v_instance.id
    returning * into v_instance;

    -- التوكن يبقى محجوزاً لنفس النسخة؛ إن كان محرَّراً، اسحب واحداً جديداً
    if v_instance.token_id is null then
      v_token := claim_token(p_product_type, v_instance.id);
      if v_token.id is null then
        raise exception 'NO_TOKEN_AVAILABLE';
      end if;
      update bot_instances
         set token_id = v_token.id,
             bot_application_id = v_token.bot_application_id
       where id = v_instance.id
      returning * into v_instance;
    end if;
  else
    -- 2) نسخة جديدة: أنشئها أولاً للحصول على id، ثم اسحب توكناً واربطه
    insert into bot_instances (product_type, guild_id, guild_name, owner_id, account_id,
                               plan_type, status, started_at, expires_at)
    values (p_product_type, p_guild_id, p_guild_name, p_owner_id, p_account_id,
            'paid', 'active', now(), now() + make_interval(days => p_duration_days))
    returning * into v_instance;

    v_token := claim_token(p_product_type, v_instance.id);
    if v_token.id is null then
      raise exception 'NO_TOKEN_AVAILABLE';   -- يتراجع عن إدراج النسخة تلقائياً
    end if;

    update bot_instances
       set token_id = v_token.id,
           bot_application_id = v_token.bot_application_id
     where id = v_instance.id
    returning * into v_instance;
  end if;

  -- 3) سجّل/جدّد الاشتراك
  insert into subscriptions (account_id, owner_id, guild_id, product_type, instance_id,
                             plan_name, status, starts_at, expires_at, external_ref)
  values (p_account_id, p_owner_id, p_guild_id, p_product_type, v_instance.id,
          p_plan_name, 'active', now(), v_instance.expires_at, p_external_ref)
  on conflict (external_ref) where external_ref is not null
  do update set status = 'active', expires_at = excluded.expires_at, updated_at = now();

  return v_instance;
end;
$$;
