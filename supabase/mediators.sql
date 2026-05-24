-- ============================================================
-- Mediator Management System Tables
-- ============================================================

-- Table for storing mediator profiles and stats
CREATE TABLE IF NOT EXISTS public.mediators (
  user_id text PRIMARY KEY,
  username text NOT NULL,
  status text NOT NULL DEFAULT 'trial', -- 'trial' (New Mediator), 'trusted' (Trusted Mediator), 'removed' (Removed)
  assigned_by text NOT NULL,
  assigned_by_tag text NOT NULL,
  assigned_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  assigned_reason text,
  trial_period text,
  notes text,
  promoted_by text,
  promoted_by_tag text,
  promoted_at timestamptz,
  removed_by text,
  removed_by_tag text,
  removed_at timestamptz,
  removed_reason text,
  tickets_claimed integer NOT NULL DEFAULT 0,
  tickets_completed integer NOT NULL DEFAULT 0,
  complaints_count integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

-- Table for storing administrative actions history
CREATE TABLE IF NOT EXISTS public.mediator_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  username text NOT NULL,
  action text NOT NULL, -- 'assign', 'promote', 'remove', 'update'
  actor_id text NOT NULL,
  actor_tag text NOT NULL,
  reason text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

-- Trigger to update updated_at automatically on mediators
CREATE OR REPLACE FUNCTION public.set_mediators_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  new.updated_at = timezone('utc', now());
  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS trg_mediators_updated_at ON public.mediators;
CREATE TRIGGER trg_mediators_updated_at
BEFORE UPDATE ON public.mediators
FOR EACH ROW
EXECUTE FUNCTION public.set_mediators_updated_at();

-- Disable RLS to allow direct management via service role
ALTER TABLE public.mediators DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.mediator_history DISABLE ROW LEVEL SECURITY;

-- Grant permissions to service_role
GRANT ALL ON TABLE public.mediators TO service_role;
GRANT ALL ON TABLE public.mediator_history TO service_role;
