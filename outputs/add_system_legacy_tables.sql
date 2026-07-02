-- Run once in Supabase SQL editor to satisfy the legacy SystemBot XP/economy/settings tables.
-- Fixes: Could not find the table 'public.members' in the schema cache.

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

-- Force PostgREST/Supabase to refresh its schema cache after creating members/users.
notify pgrst, 'reload schema';
