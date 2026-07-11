-- Encrypted custom-project requests and private owner/customer conversations.
-- Apply once in Supabase before deploying the website feature.

create extension if not exists pgcrypto;

create table if not exists public.project_requests (
  id uuid primary key default gen_random_uuid(),
  requester_hash text not null,
  access_token_hash text not null,
  requester_discord_id_enc text,
  requester_name_enc text,
  phone_enc text,
  status text not null default 'new' check (status in ('new', 'open', 'closed')),
  owner_unread boolean not null default true,
  customer_unread boolean not null default false,
  customer_typing_until timestamptz,
  owner_typing_until timestamptz,
  created_at timestamptz not null default now(),
  last_message_at timestamptz not null default now()
);

-- Safe when upgrading a deployment where the original project_requests table already exists.
alter table public.project_requests add column if not exists access_token_hash text;
alter table public.project_requests add column if not exists customer_typing_until timestamptz;
alter table public.project_requests add column if not exists owner_typing_until timestamptz;
alter table public.project_requests alter column requester_discord_id_enc drop not null;

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
