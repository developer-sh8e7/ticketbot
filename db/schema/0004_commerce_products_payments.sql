-- Opus Solutions — 0004_commerce_products_payments
-- Products, plans, guild links, payments, PayPal events, feature flags and product configs.

create table if not exists products (
  id text primary key,
  product_type text unique check (product_type in ('ticket','voice_rooms','general')),
  name text not null,
  description text not null,
  is_custom boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists plans (
  id text primary key,
  product_id text references products(id) on delete cascade,
  name text not null,
  interval text not null check (interval in ('monthly','quarterly','yearly','custom')),
  duration_days int not null check (duration_days > 0),
  amount_cents int not null check (amount_cents >= 0),
  currency text not null default 'USD',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists guilds (
  id text primary key,
  owner_account_id uuid references accounts(id) on delete set null,
  owner_discord_user_id text,
  name text,
  icon_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists product_configs (
  id uuid primary key default gen_random_uuid(),
  product_type text not null check (product_type in ('ticket','voice_rooms','general')),
  key text not null,
  value jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(product_type, key)
);

create table if not exists feature_flags (
  id uuid primary key default gen_random_uuid(),
  product_type text check (product_type in ('ticket','voice_rooms','general')),
  key text not null,
  enabled boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(product_type, key)
);

create table if not exists payments (
  id uuid primary key default gen_random_uuid(),
  account_id uuid references accounts(id) on delete set null,
  subscription_id uuid references subscriptions(id) on delete set null,
  product_id text references products(id),
  plan_id text references plans(id),
  paypal_order_id text unique,
  paypal_capture_id text,
  status text not null check (status in ('created','approved','captured','failed','refunded','cancelled')),
  amount_cents int not null,
  currency text not null default 'USD',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists payment_events (
  id bigserial primary key,
  payment_id uuid references payments(id) on delete set null,
  provider text not null default 'paypal',
  event_type text not null,
  external_event_id text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_payments_account on payments(account_id);
create index if not exists idx_payment_events_external on payment_events(external_event_id);

insert into products (id, product_type, name, description, is_custom) values
  ('ticket-bot','ticket','Ticket Bot','Advanced Discord ticketing, panels, transcripts, mediators and escalation.', false),
  ('voice-rooms-bot','voice_rooms','TempRooms Bot','Join-to-create temporary voice rooms with owner control panel.', false),
  ('general-system-bot','general','General/System Bot','Moderation, logs, levels, economy and utility systems.', false),
  ('custom-bot', null, 'Custom Bot','A bespoke Discord bot built with the developers for your idea.', true)
on conflict (id) do update set name = excluded.name, description = excluded.description, is_custom = excluded.is_custom;

insert into plans (id, product_id, name, interval, duration_days, amount_cents, currency) values
  ('ticket-monthly','ticket-bot','Monthly','monthly',30,999,'USD'),
  ('ticket-quarterly','ticket-bot','Quarterly','quarterly',90,2799,'USD'),
  ('voice-rooms-monthly','voice-rooms-bot','Monthly','monthly',30,799,'USD'),
  ('voice-rooms-quarterly','voice-rooms-bot','Quarterly','quarterly',90,2199,'USD'),
  ('general-monthly','general-system-bot','Monthly','monthly',30,1299,'USD'),
  ('general-quarterly','general-system-bot','Quarterly','quarterly',90,3599,'USD')
on conflict (id) do update set amount_cents = excluded.amount_cents, duration_days = excluded.duration_days;
