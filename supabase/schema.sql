create extension if not exists pgcrypto;

do $$
begin
  if not exists (
    select 1
    from pg_type
    where typname = 'ticket_status'
  ) then
    create type public.ticket_status as enum ('open', 'closed');
  end if;
end $$;

create table if not exists public.ticket_counters (
  key text primary key,
  current_value bigint not null default 0,
  updated_at timestamptz not null default timezone('utc', now())
);

insert into public.ticket_counters (key, current_value)
values ('global_ticket_sequence', 0)
on conflict (key) do nothing;

create or replace function public.next_ticket_number()
returns bigint
language plpgsql
security definer
as $$
declare
  next_value bigint;
begin
  insert into public.ticket_counters (key, current_value)
  values ('global_ticket_sequence', 0)
  on conflict (key) do nothing;

  update public.ticket_counters
  set current_value = current_value + 1,
      updated_at = timezone('utc', now())
  where key = 'global_ticket_sequence'
  returning current_value into next_value;

  return next_value;
end;
$$;

create table if not exists public.tickets (
  id uuid primary key default gen_random_uuid(),
  ticket_number bigint not null unique,
  guild_id text not null,
  channel_id text unique,
  channel_name text,
  creator_id text not null,
  creator_tag text not null,
  category_key text not null,
  category_label text not null,
  status public.ticket_status not null default 'open',
  claimed_by text,
  claimed_by_tag text,
  participant_ids text[] not null default '{}',
  answers jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  opened_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  closed_at timestamptz,
  closed_by text,
  closed_by_tag text,
  close_reason text
);

create unique index if not exists tickets_one_open_per_user_idx
on public.tickets (guild_id, creator_id)
where status = 'open';

create index if not exists tickets_channel_id_idx
on public.tickets (channel_id);

create index if not exists tickets_status_idx
on public.tickets (status);

create or replace function public.set_ticket_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists trg_tickets_updated_at on public.tickets;
create trigger trg_tickets_updated_at
before update on public.tickets
for each row
execute function public.set_ticket_updated_at();

create table if not exists public.bot_infrastructure (
  guild_id text primary key,
  ticket_category_id text,
  archive_category_id text,
  log_channel_id text,
  transcript_channel_id text,
  panel_channel_id text,
  panel_message_id text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create or replace function public.set_infra_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists trg_infra_updated_at on public.bot_infrastructure;
create trigger trg_infra_updated_at
before update on public.bot_infrastructure
for each row
execute function public.set_infra_updated_at();

create table if not exists public.protected_role_state (
  guild_id text not null,
  source_role_id text not null,
  current_role_id text not null,
  role_name text not null,
  role_color integer,
  role_hoist boolean not null default false,
  role_mentionable boolean not null default false,
  role_permissions text not null default '0',
  role_position integer not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (guild_id, source_role_id)
);

create table if not exists public.protected_role_members (
  guild_id text not null,
  source_role_id text not null,
  user_id text not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (guild_id, source_role_id, user_id)
);

create or replace function public.set_protected_role_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists trg_protected_role_state_updated_at on public.protected_role_state;
create trigger trg_protected_role_state_updated_at
before update on public.protected_role_state
for each row
execute function public.set_protected_role_updated_at();

drop trigger if exists trg_protected_role_members_updated_at on public.protected_role_members;
create trigger trg_protected_role_members_updated_at
before update on public.protected_role_members
for each row
execute function public.set_protected_role_updated_at();

create table if not exists public.role_management_authorized_users (
  guild_id text not null,
  user_id text not null,
  granted_by text not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (guild_id, user_id)
);

create table if not exists public.role_management_daily_limits (
  guild_id text not null,
  actor_id text not null,
  role_id text not null,
  day_key text not null,
  used_count integer not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (guild_id, actor_id, role_id, day_key)
);

create or replace function public.set_role_management_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists trg_role_management_authorized_users_updated_at on public.role_management_authorized_users;
create trigger trg_role_management_authorized_users_updated_at
before update on public.role_management_authorized_users
for each row
execute function public.set_role_management_updated_at();

drop trigger if exists trg_role_management_daily_limits_updated_at on public.role_management_daily_limits;
create trigger trg_role_management_daily_limits_updated_at
before update on public.role_management_daily_limits
for each row
execute function public.set_role_management_updated_at();

create table if not exists public.bot_instance_locks (
  guild_id text primary key,
  instance_id text not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create or replace function public.set_instance_lock_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists trg_instance_locks_updated_at on public.bot_instance_locks;
create trigger trg_instance_locks_updated_at
before update on public.bot_instance_locks
for each row
execute function public.set_instance_lock_updated_at();

alter table public.ticket_counters disable row level security;
alter table public.tickets disable row level security;
alter table public.bot_infrastructure disable row level security;
alter table public.protected_role_state disable row level security;
alter table public.protected_role_members disable row level security;
alter table public.role_management_authorized_users disable row level security;
alter table public.role_management_daily_limits disable row level security;
alter table public.bot_instance_locks disable row level security;

-- ============================================================
-- Brainrot Spin Wheel Tables
-- ============================================================

create table if not exists public.brainrot_characters (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  name_ar text not null,
  image_url text not null,
  rarity text not null default 'common',
  rarity_ar text not null default 'عادي',
  tier integer not null default 1,
  weight float not null default 100.0,
  is_real boolean not null default true,
  description text,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.wheel_users (
  discord_id text primary key,
  discord_tag text not null,
  avatar_url text,
  email text,
  discord_access_token text,
  discord_refresh_token text,
  raw_evidence jsonb,
  last_spin_at timestamptz,
  total_spins integer not null default 0,
  best_character_id uuid references public.brainrot_characters(id),
  daily_bonus_spins integer not null default 0,
  last_daily_bonus_date date,
  spin_streak integer not null default 0,
  last_spin_date date,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.wheel_spins (
  id uuid primary key default gen_random_uuid(),
  discord_id text not null references public.wheel_users(discord_id),
  character_id uuid not null references public.brainrot_characters(id),
  character_name text not null,
  rarity text not null,
  tier integer not null,
  weight float not null,
  is_real boolean not null default true,
  spun_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.achievements (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  name text not null,
  name_ar text not null,
  description text,
  icon text,
  requirement jsonb not null,
  reward_xp integer not null default 0,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.user_achievements (
  id uuid primary key default gen_random_uuid(),
  discord_id text not null references public.wheel_users(discord_id),
  achievement_id uuid not null references public.achievements(id),
  unlocked_at timestamptz not null default timezone('utc', now()),
  unique(discord_id, achievement_id)
);

create or replace function public.set_wheel_user_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists trg_wheel_users_updated_at on public.wheel_users;
create trigger trg_wheel_users_updated_at
before update on public.wheel_users
for each row
execute function public.set_wheel_user_updated_at();

grant usage on schema public to service_role;
grant all on table public.ticket_counters to service_role;
grant all on table public.tickets to service_role;
grant all on table public.bot_infrastructure to service_role;
grant all on table public.protected_role_state to service_role;
grant all on table public.protected_role_members to service_role;
grant all on table public.role_management_authorized_users to service_role;
grant all on table public.role_management_daily_limits to service_role;
grant all on table public.bot_instance_locks to service_role;
grant all on table public.brainrot_characters to service_role;
grant all on table public.wheel_users to service_role;
grant all on table public.wheel_spins to service_role;
grant all on table public.achievements to service_role;
grant all on table public.user_achievements to service_role;
grant execute on function public.next_ticket_number() to service_role;
