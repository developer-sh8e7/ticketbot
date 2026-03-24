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

alter table public.ticket_counters disable row level security;
alter table public.tickets disable row level security;
alter table public.bot_infrastructure disable row level security;

grant usage on schema public to service_role;
grant all on table public.ticket_counters to service_role;
grant all on table public.tickets to service_role;
grant all on table public.bot_infrastructure to service_role;
grant execute on function public.next_ticket_number() to service_role;
