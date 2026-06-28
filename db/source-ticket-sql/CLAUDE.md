# `supabase/` — SQL Schema Definitions

## Overview

One `.sql` file per feature. All files are designed to be run in the Supabase SQL Editor (idempotent — `CREATE TABLE IF NOT EXISTS`, `DROP TRIGGER IF EXISTS`, etc.). No migration framework.

## Key Files

| File | Tables | Run Order |
|------|--------|-----------|
| `schema.sql` | tickets, ticket_counters, bot_infrastructure, brainrot_characters, wheel + role management + achievements | 1st |
| `trial.sql` | bot_instances, bot_configs, trials, subscriptions, service_events | 2nd |
| `mediator_verification.sql` | mediator_verification, mediator_otp_records, rate_limit_log | 3rd |
| `mediator_application_system.sql` | mediator_config, mediator_applications (+ alters mediator_verification) | 4th |
| `mediators.sql` | mediators, mediator_history | 5th |
| `complaints.sql` | complaints | 6th |
| `achievements.sql` | Seed data for achievements | 7th |
| `brainrot_characters.sql` | Seed data for wheel characters | 8th |

## Key Patterns

### Table creation
```sql
create table if not exists public.trials (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  status text not null default 'active' check (status in ('active', 'expired', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```
UUID PKs (`gen_random_uuid()`), `text` for Discord snowflakes, inline `CHECK` for enum-like columns, `timestamptz` timestamps.

### Trigger-based updated_at
```sql
drop trigger if exists set_trials_updated_at on public.trials;
create trigger set_trials_updated_at before update on public.trials
  for each row execute function set_updated_at();
```

### Idempotency pattern
All files use `IF NOT EXISTS`, `CREATE OR REPLACE FUNCTION`, `ON CONFLICT DO NOTHING`, and `DROP ... IF EXISTS` so they can be re-run safely.

<important if="you are adding a new table">
Follow the `trial.sql` pattern: `CREATE TABLE` + constraints + indexes + trigger + RLS. Use `id uuid primary key default gen_random_uuid()`, `created_at timestamptz default now()`, `updated_at timestamptz default now()`.
</important>
