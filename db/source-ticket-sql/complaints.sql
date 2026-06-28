-- ============================================================
-- Complaints & Objections Management System Tables
-- ============================================================

-- Table for storing user complaints
CREATE TABLE IF NOT EXISTS public.complaints (
  complaint_id serial PRIMARY KEY,
  user_id text NOT NULL,
  mediator_id text,
  ticket_id text,
  trade_value text,
  mediator_type text,
  complaint_type text NOT NULL, -- 'mediator' or 'general'
  category text, -- 'نصب', 'تأخير', 'سوء تعامل', 'مشكلة ضمان', 'أخرى'
  description text NOT NULL,
  evidence jsonb NOT NULL DEFAULT '[]'::jsonb, -- Array of attachment files (name, original_url, permanent_url, size, contentType)
  status text NOT NULL DEFAULT 'open', -- 'open', 'reviewing', 'solved'
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  handled_by text,
  channel_id text,
  resolution_notes text
);

-- Disable RLS to allow direct management via service role
ALTER TABLE public.complaints DISABLE ROW LEVEL SECURITY;

-- Grant permissions to service_role
GRANT ALL ON TABLE public.complaints TO service_role;
