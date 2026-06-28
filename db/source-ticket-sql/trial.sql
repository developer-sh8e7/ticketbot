-- Opus Bot Manager schema for Supabase
-- Run this file in Supabase SQL Editor.
-- Stores trials/subscriptions in Supabase only. Do NOT use local JSON for trial state.

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.bot_instances (
  id uuid primary key default gen_random_uuid(),
  bot_user_id text,
  bot_name text not null,
  bot_token_encrypted text not null,
  guild_id text,
  guild_name text,
  owner_id text,
  product_type text not null default 'ticket' check (product_type in ('ticket', 'system', 'verify', 'custom', 'web')),
  plan_type text not null default 'trial' check (plan_type in ('trial', 'paid')),
  status text not null default 'active' check (status in ('active', 'expired', 'cancelled', 'paused', 'rejected')),
  config_id uuid,
  started_at timestamptz,
  expires_at timestamptz,
  support_ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_started_at timestamptz,
  last_stopped_at timestamptz,
  expired_notified_at timestamptz,
  notes text
);

create table if not exists public.bot_configs (
  id uuid primary key default gen_random_uuid(),
  bot_instance_id uuid references public.bot_instances(id) on delete cascade,
  guild_id text,
  config_name text not null default 'default',
  config_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.bot_instances
  drop constraint if exists bot_instances_config_id_fkey;

alter table public.bot_instances
  add constraint bot_instances_config_id_fkey
  foreign key (config_id) references public.bot_configs(id) on delete set null;

create table if not exists public.trials (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  guild_id text not null,
  guild_name text,
  owner_id text,
  product_type text not null default 'ticket' check (product_type in ('ticket', 'system', 'verify', 'custom', 'web')),
  bot_instance_id uuid references public.bot_instances(id) on delete set null,
  status text not null default 'active' check (status in ('active', 'expired', 'cancelled', 'paused', 'rejected')),
  accepted_by text,
  accepted_at timestamptz,
  starts_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '14 days'),
  support_ends_at timestamptz not null default (now() + interval '48 hours'),
  rejected_by text,
  rejected_at timestamptz,
  reject_reason text,
  expired_notified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint trials_once_per_user unique (user_id),
  constraint trials_once_per_guild unique (guild_id)
);

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  guild_id text not null,
  guild_name text,
  owner_id text,
  product_type text not null default 'ticket' check (product_type in ('ticket', 'system', 'verify', 'custom', 'web')),
  bot_instance_id uuid references public.bot_instances(id) on delete set null,
  plan_name text not null default 'monthly',
  status text not null default 'active' check (status in ('active', 'expired', 'cancelled', 'paused', 'rejected')),
  starts_at timestamptz not null default now(),
  expires_at timestamptz not null,
  support_ends_at timestamptz,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  expired_notified_at timestamptz
);

create table if not exists public.service_events (
  id uuid primary key default gen_random_uuid(),
  bot_instance_id uuid references public.bot_instances(id) on delete set null,
  user_id text,
  guild_id text,
  event_type text not null,
  event_message text not null,
  created_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists idx_bot_instances_status on public.bot_instances(status);
create index if not exists idx_bot_instances_guild_id on public.bot_instances(guild_id);
create index if not exists idx_bot_instances_expires_at on public.bot_instances(expires_at);
create index if not exists idx_bot_configs_instance on public.bot_configs(bot_instance_id);
create index if not exists idx_bot_configs_guild_id on public.bot_configs(guild_id);
create index if not exists idx_trials_status_expires on public.trials(status, expires_at);
create index if not exists idx_trials_owner_id on public.trials(owner_id);
create index if not exists idx_subscriptions_status_expires on public.subscriptions(status, expires_at);
create index if not exists idx_subscriptions_user_id on public.subscriptions(user_id);
create index if not exists idx_subscriptions_guild_id on public.subscriptions(guild_id);
create index if not exists idx_service_events_type_created on public.service_events(event_type, created_at desc);
create index if not exists idx_service_events_guild_id on public.service_events(guild_id);

drop trigger if exists set_bot_instances_updated_at on public.bot_instances;
create trigger set_bot_instances_updated_at
before update on public.bot_instances
for each row execute function public.set_updated_at();

drop trigger if exists set_bot_configs_updated_at on public.bot_configs;
create trigger set_bot_configs_updated_at
before update on public.bot_configs
for each row execute function public.set_updated_at();

drop trigger if exists set_trials_updated_at on public.trials;
create trigger set_trials_updated_at
before update on public.trials
for each row execute function public.set_updated_at();

drop trigger if exists set_subscriptions_updated_at on public.subscriptions;
create trigger set_subscriptions_updated_at
before update on public.subscriptions
for each row execute function public.set_updated_at();

alter table public.bot_instances enable row level security;
alter table public.bot_configs enable row level security;
alter table public.trials enable row level security;
alter table public.subscriptions enable row level security;
alter table public.service_events enable row level security;

-- The app/dashboard must use SUPABASE_SERVICE_ROLE_KEY server-side.
-- No public anon policies are created so bot tokens and service data stay private.
