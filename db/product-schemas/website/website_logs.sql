-- Website visit logs
-- Stores general/anonymous visit information for analytics.
-- No sensitive or PII data (IP is anonymized, no emails, no names).

create table if not exists website_logs (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  path text not null,
  ip_anonymized text,
  user_agent text,
  browser text,
  browser_version text,
  os text,
  os_version text,
  device_type text,  -- 'mobile', 'tablet', 'desktop', 'unknown'
  country text,       -- approximate from IP if available
  referer text
);

-- Index for time-based queries
create index if not exists idx_website_logs_created_at on website_logs (created_at desc);

-- Index for page path queries
create index if not exists idx_website_logs_path on website_logs (path);

-- Enable RLS but allow inserts only from service role (no public access)
alter table website_logs enable row level security;

-- Only service role can insert (website backend)
create policy "Service role can insert website_logs"
  on website_logs
  for insert
  to service_role
  with check (true);

-- Only service role can select (admin dashboard)
create policy "Service role can select website_logs"
  on website_logs
  for select
  to service_role
  using (true);
