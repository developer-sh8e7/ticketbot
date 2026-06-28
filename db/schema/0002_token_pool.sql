-- ════════════════════════════════════════════════════════════════
-- Opus Solutions — 0002_token_pool
-- بركة التوكنات + السحب الذرّي
--
-- النقطة الحرجة: مستحيل يأخذ زبونان نفس التوكن ولو اشترى 100 شخص
-- في نفس اللحظة. الضمان على مستوى قاعدة البيانات عبر:
--   FOR UPDATE SKIP LOCKED  +  فهرس فريد جزئي.
-- ════════════════════════════════════════════════════════════════

-- ── بركة التوكنات: 20 توكن مسجّل مسبقاً لكل منتج، كلها مشفّرة ──
create table if not exists token_pool (
  id                     uuid primary key default gen_random_uuid(),
  product_type           text not null check (product_type in ('ticket','voice_rooms','general')),
  bot_application_id     text not null,                 -- Discord application/client ID
  bot_token_encrypted    text not null,                 -- Fernet-encrypted — لا يُخزَّن نصاً أبداً
  status                 text not null default 'available'
                           check (status in ('available','claimed','disabled')),
  claimed_by_instance_id uuid,                          -- FK منطقي → bot_instances.id
  claimed_at             timestamptz,
  label                  text,                          -- وسم وصفي اختياري للإدارة
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  unique (bot_application_id)
);

-- توكن واحد لكل تطبيق، وكل توكن مسحوب لا يُربط إلا بنسخة واحدة:
create unique index if not exists uq_token_pool_one_claim_per_instance
  on token_pool(claimed_by_instance_id)
  where claimed_by_instance_id is not null;

-- يسرّع البحث عن أول توكن متاح للمنتج:
create index if not exists idx_token_pool_available
  on token_pool(product_type, created_at)
  where status = 'available';

-- ════════════════════════════════════════════════════════════════
-- claim_token(): يسحب توكناً متاحاً ذرّياً ويحجزه.
--
-- FOR UPDATE SKIP LOCKED: كل معاملة متزامنة تقفل صفاً مختلفاً وتتجاوز
-- الصفوف المقفولة، فلا يحصل تنافس على نفس التوكن إطلاقاً.
-- يعيد الصف المحجوز، أو NULL إذا نفدت التوكنات المتاحة.
-- ════════════════════════════════════════════════════════════════
create or replace function claim_token(
  p_product_type text,
  p_instance_id  uuid
)
returns token_pool
language plpgsql
as $$
declare
  v_token token_pool;
begin
  select *
    into v_token
    from token_pool
   where product_type = p_product_type
     and status = 'available'
   order by created_at
   for update skip locked
   limit 1;

  if not found then
    return null;                       -- لا يوجد توكن متاح لهذا المنتج
  end if;

  update token_pool
     set status = 'claimed',
         claimed_by_instance_id = p_instance_id,
         claimed_at = now(),
         updated_at = now()
   where id = v_token.id
  returning * into v_token;

  return v_token;
end;
$$;

-- ════════════════════════════════════════════════════════════════
-- release_token(): يحرّر توكن نسخة (عند الإلغاء النهائي فقط).
-- ملاحظة: عند انتهاء الاشتراك العادي لا نحرّر التوكن بالضرورة —
-- نبقيه محجوزاً لنفس النسخة حتى يجدّد الزبون فيرجع بنفس البوت.
-- التحرير يجعل التوكن متاحاً لزبون آخر.
-- ════════════════════════════════════════════════════════════════
create or replace function release_token(p_instance_id uuid)
returns void
language plpgsql
as $$
begin
  update token_pool
     set status = 'available',
         claimed_by_instance_id = null,
         claimed_at = null,
         updated_at = now()
   where claimed_by_instance_id = p_instance_id;
end;
$$;

-- عدّاد التوكنات المتاحة لكل منتج (لتنبيه الإدارة قبل النفاد):
create or replace function available_token_count(p_product_type text)
returns integer
language sql
stable
as $$
  select count(*)::int
    from token_pool
   where product_type = p_product_type
     and status = 'available';
$$;
