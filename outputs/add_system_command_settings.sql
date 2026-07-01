-- Run once in Supabase SQL editor before deploying the dashboard/system-bot command settings.
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

create table if not exists guild_warnings (
  id           uuid primary key default gen_random_uuid(),
  guild_id     text not null,
  user_id      text not null,
  moderator_id text not null,
  reason       text not null,
  created_at   timestamptz not null default now()
);

create index if not exists idx_guild_warnings_member on guild_warnings(guild_id, user_id, created_at desc);
