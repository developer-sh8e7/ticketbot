-- ============================================================
-- Mediator Warning System Tables
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.mediator_warnings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id text NOT NULL,
  user_id text NOT NULL,
  username text NOT NULL,
  reason text NOT NULL,
  warned_by text NOT NULL,
  warned_by_tag text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  removed_by text,
  removed_by_tag text,
  removed_at timestamptz,
  remove_reason text,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_mediator_warnings_guild_user_active
  ON public.mediator_warnings (guild_id, user_id, active, created_at DESC);

-- Disable RLS to allow direct management via service role
ALTER TABLE public.mediator_warnings DISABLE ROW LEVEL SECURITY;

-- Grant permissions to service_role
GRANT ALL ON TABLE public.mediator_warnings TO service_role;
