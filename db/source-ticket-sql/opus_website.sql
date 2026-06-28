-- Opus Ticket Website schema
-- Run once in Supabase SQL Editor.
-- This file is independent from the legacy trial.sql and does not alter legacy tables.

create extension if not exists pgcrypto;

create table if not exists public.sellapp_orders (
  id uuid primary key default gen_random_uuid(),
  order_id text not null,
  invoice_id text,
  -- Customer PII: always encrypted at rest. Use customer_email_hash for lookups.
  customer_email_enc text,
  customer_email_hash text,
  customer_name_enc text,
  -- Payment / product metadata (non-sensitive operational fields stay plain)
  product_id text,
  listing_id text,
  product_slug text,
  product_name text,
  amount text,
  currency text default 'USD',
  status text not null default 'received',
  -- Raw webhook payload: encrypted if it contains PII
  raw_metadata jsonb not null default '{}'::jsonb,
  raw_metadata_enc text,
  -- Hash-based dedup keys
  order_id_hash text,
  invoice_id_hash text,
  encryption_version int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sellapp_orders_order_id_unique unique (order_id),
  constraint sellapp_orders_status_check check (status in ('received','completed','ignored','refunded','disputed','cancelled','failed')),
  constraint sellapp_orders_no_card_data check (
    not (raw_metadata ? 'card_number')
    and not (raw_metadata ? 'cvv')
    and not (raw_metadata ? 'expiry')
    and not (raw_metadata ? 'payment_credentials')
  )
);

create table if not exists public.activation_codes (
  id uuid primary key default gen_random_uuid(),
  -- Activation code: stored encrypted. code_hash is the searchable lookup.
  code_enc text not null,
  code_hash text not null,
  order_id text not null,
  invoice_id text,
  -- Customer PII: always encrypted. Use email_hash for lookups.
  customer_email_enc text,
  customer_email_hash text,
  owner_discord_username_enc text,
  owner_discord_avatar_enc text,
  -- Operational fields (non-sensitive, stay plain)
  product_id text,
  product_type text not null default 'ticket',
  product_name text,
  plan_type text not null default 'paid',
  bot_instance_id uuid references public.bot_instances(id) on delete set null,
  owner_discord_id text,
  guild_id text,
  status text not null default 'unused',
  used_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  expires_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  metadata_enc text,
  encryption_version int not null default 1,
  constraint activation_codes_code_hash_unique unique (code_hash),
  constraint activation_codes_order_id_unique unique (order_id),
  constraint activation_codes_status_check check (status in ('unused','claimed','active','expired','cancelled','revoked')),
  constraint activation_codes_product_type_check check (product_type in ('ticket','system','verify','custom','web')),
  constraint activation_codes_plan_type_check check (plan_type in ('paid','trial','manual')),
  constraint activation_codes_owner_format check (owner_discord_id is null or owner_discord_id ~ '^\d{17,20}$'),
  constraint activation_codes_guild_format check (guild_id is null or guild_id ~ '^\d{17,20}$')
);

create table if not exists public.customer_sessions (
  id uuid primary key,
  discord_user_id text not null,
  username text,
  avatar_url text,
  user_agent text,
  ip_address text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  constraint customer_sessions_discord_user_id_check check (discord_user_id ~ '^\d{17,20}$')
);

create table if not exists public.website_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  user_id text,
  guild_id text,
  bot_instance_id uuid references public.bot_instances(id) on delete set null,
  order_id text,
  message text not null,
  message_enc text,
  metadata jsonb not null default '{}'::jsonb,
  metadata_enc text,
  encryption_version int not null default 1,
  created_at timestamptz not null default now(),
  constraint website_events_user_id_check check (user_id is null or user_id ~ '^\d{17,20}$'),
  constraint website_events_guild_id_check check (guild_id is null or guild_id ~ '^\d{17,20}$')
);

create table if not exists public.website_rate_limits (
  id uuid primary key default gen_random_uuid(),
  scope text not null,
  identifier_hash text not null,
  count integer not null default 1,
  reset_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  constraint website_rate_limits_scope_identifier_unique unique (scope, identifier_hash)
);

create index if not exists idx_sellapp_orders_invoice_id on public.sellapp_orders(invoice_id) where invoice_id is not null;
create index if not exists idx_sellapp_orders_product_id on public.sellapp_orders(product_id) where product_id is not null;
create index if not exists idx_sellapp_orders_status on public.sellapp_orders(status);
create index if not exists idx_sellapp_orders_created_at on public.sellapp_orders(created_at desc);
create index if not exists idx_sellapp_orders_customer_email_hash on public.sellapp_orders(customer_email_hash) where customer_email_hash is not null;
create index if not exists idx_sellapp_orders_order_id_hash on public.sellapp_orders(order_id_hash) where order_id_hash is not null;
create index if not exists idx_sellapp_orders_invoice_id_hash on public.sellapp_orders(invoice_id_hash) where invoice_id_hash is not null;

create unique index if not exists idx_activation_codes_invoice_id_unique on public.activation_codes(invoice_id) where invoice_id is not null;
create index if not exists idx_activation_codes_owner_discord_id on public.activation_codes(owner_discord_id) where owner_discord_id is not null;
create index if not exists idx_activation_codes_guild_id on public.activation_codes(guild_id) where guild_id is not null;
create index if not exists idx_activation_codes_bot_instance_id on public.activation_codes(bot_instance_id) where bot_instance_id is not null;
create index if not exists idx_activation_codes_status on public.activation_codes(status);
create index if not exists idx_activation_codes_expires_at on public.activation_codes(expires_at) where expires_at is not null;
create index if not exists idx_activation_codes_created_at on public.activation_codes(created_at desc);
create index if not exists idx_activation_codes_code_hash on public.activation_codes(code_hash);
create index if not exists idx_activation_codes_customer_email_hash on public.activation_codes(customer_email_hash) where customer_email_hash is not null;

create index if not exists idx_customer_sessions_discord_user_id on public.customer_sessions(discord_user_id);
create index if not exists idx_customer_sessions_expires_at on public.customer_sessions(expires_at);
create index if not exists idx_customer_sessions_revoked_at on public.customer_sessions(revoked_at) where revoked_at is not null;

create index if not exists idx_website_events_event_type on public.website_events(event_type);
create index if not exists idx_website_events_created_at on public.website_events(created_at desc);
create index if not exists idx_website_events_user_id on public.website_events(user_id) where user_id is not null;
create index if not exists idx_website_events_guild_id on public.website_events(guild_id) where guild_id is not null;
create index if not exists idx_website_events_bot_instance_id on public.website_events(bot_instance_id) where bot_instance_id is not null;
create index if not exists idx_website_events_order_id on public.website_events(order_id) where order_id is not null;

create index if not exists idx_website_rate_limits_reset_at on public.website_rate_limits(reset_at);

create or replace function public.set_opus_website_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_sellapp_orders_updated_at on public.sellapp_orders;
create trigger set_sellapp_orders_updated_at
before update on public.sellapp_orders
for each row execute function public.set_opus_website_updated_at();

drop trigger if exists set_activation_codes_updated_at on public.activation_codes;
create trigger set_activation_codes_updated_at
before update on public.activation_codes
for each row execute function public.set_opus_website_updated_at();

drop trigger if exists set_customer_sessions_updated_at on public.customer_sessions;
create trigger set_customer_sessions_updated_at
before update on public.customer_sessions
for each row execute function public.set_opus_website_updated_at();

drop trigger if exists set_website_rate_limits_updated_at on public.website_rate_limits;
create trigger set_website_rate_limits_updated_at
before update on public.website_rate_limits
for each row execute function public.set_opus_website_updated_at();

alter table public.sellapp_orders enable row level security;
alter table public.activation_codes enable row level security;
alter table public.customer_sessions enable row level security;
alter table public.website_events enable row level security;
alter table public.website_rate_limits enable row level security;

-- No public RLS policies are created on purpose.
-- The website uses SUPABASE_SERVICE_ROLE_KEY on the server only.
-- Do not expose the service role key to the browser.
