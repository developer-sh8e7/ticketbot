-- Migration: Add encrypted field columns to existing tables
-- Run this in Supabase SQL Editor if you already ran opus_website.sql
-- and need to add encryption support without dropping tables.

-- ─── sellapp_orders ───────────────────────────────────────────────────────────

alter table public.sellapp_orders
  add column if not exists customer_email_enc text,
  add column if not exists customer_email_hash text,
  add column if not exists customer_name_enc text,
  add column if not exists order_id_hash text,
  add column if not exists invoice_id_hash text,
  add column if not exists raw_metadata_enc text,
  add column if not exists encryption_version int not null default 1;

create index if not exists idx_sellapp_orders_customer_email_hash
  on public.sellapp_orders(customer_email_hash)
  where customer_email_hash is not null;

create index if not exists idx_sellapp_orders_order_id_hash
  on public.sellapp_orders(order_id_hash)
  where order_id_hash is not null;

create index if not exists idx_sellapp_orders_invoice_id_hash
  on public.sellapp_orders(invoice_id_hash)
  where invoice_id_hash is not null;

-- ─── activation_codes ─────────────────────────────────────────────────────────

alter table public.activation_codes
  add column if not exists code_enc text,
  add column if not exists code_hash text,
  add column if not exists customer_email_enc text,
  add column if not exists customer_email_hash text,
  add column if not exists owner_discord_username_enc text,
  add column if not exists owner_discord_avatar_enc text,
  add column if not exists metadata_enc text,
  add column if not exists encryption_version int not null default 1;

create unique index if not exists idx_activation_codes_code_hash
  on public.activation_codes(code_hash);

create index if not exists idx_activation_codes_customer_email_hash
  on public.activation_codes(customer_email_hash)
  where customer_email_hash is not null;

-- ─── website_events ───────────────────────────────────────────────────────────

alter table public.website_events
  add column if not exists message_enc text,
  add column if not exists metadata_enc text,
  add column if not exists encryption_version int not null default 1;

-- ─── Remove old plaintext columns once migration is complete ─────────────────
-- After running this migration and updating all application code:
--   1. Backfill: UPDATE sellapp_orders SET customer_email_enc = encrypt(customer_email), customer_email_hash = hash(customer_email) WHERE customer_email IS NOT NULL;
--   2. Backfill: UPDATE activation_codes SET code_enc = encrypt(code), code_hash = hash(code) WHERE code IS NOT NULL;
--   3. Verify data integrity
--   4. ALTER TABLE sellapp_orders DROP COLUMN customer_email;
--   5. ALTER TABLE activation_codes DROP COLUMN code, DROP COLUMN customer_email;
-- NOTE: Steps 4-5 are destructive. Only run after confirming all data is migrated.
