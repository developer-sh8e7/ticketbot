-- SystemBot jail feature tables.
-- Run this in Supabase before enabling نظام السجن from the dashboard.

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
