-- Linked Users Table
-- Stores Discord users who link their accounts to the bot

CREATE TABLE IF NOT EXISTS public.linked_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  discord_id TEXT UNIQUE NOT NULL,
  discord_username TEXT NOT NULL,
  discord_display_name TEXT,
  discord_avatar_url TEXT,
  discord_global_name TEXT,
  email_encrypted TEXT,
  phone_encrypted TEXT,
  linked_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_linked_users_discord_id
  ON public.linked_users (discord_id);

-- Auto-update updated_at on row modification
CREATE OR REPLACE FUNCTION public.set_linked_user_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = timezone('utc', now());
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_linked_users_updated_at ON public.linked_users;
CREATE TRIGGER trg_linked_users_updated_at
BEFORE UPDATE ON public.linked_users
FOR EACH ROW
EXECUTE FUNCTION public.set_linked_user_updated_at();

-- Add columns for existing installations (safe to run multiple times)
ALTER TABLE public.linked_users ADD COLUMN IF NOT EXISTS email_encrypted TEXT;
ALTER TABLE public.linked_users ADD COLUMN IF NOT EXISTS phone_encrypted TEXT;

ALTER TABLE public.linked_users DISABLE ROW LEVEL SECURITY;
GRANT ALL ON TABLE public.linked_users TO service_role;
