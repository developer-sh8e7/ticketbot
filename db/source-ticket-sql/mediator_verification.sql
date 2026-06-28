CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS mediator_verification (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  discord_id TEXT UNIQUE NOT NULL,
  discord_username TEXT NOT NULL,
  discord_display_name TEXT,
  discord_avatar_url TEXT,
  phone_hash TEXT UNIQUE,
  phone_lookup_hash TEXT UNIQUE,
  is_fully_verified BOOLEAN DEFAULT FALSE,
  verification_token TEXT UNIQUE,
  jwt_jti_hash TEXT,
  jwt_expires_at TIMESTAMPTZ,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  verified_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS mediator_otp_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_hash TEXT NOT NULL,
  otp_hash TEXT NOT NULL,
  discord_id TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  attempts INTEGER DEFAULT 0,
  used BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_otp_lookup
  ON mediator_otp_records (phone_hash, used, expires_at);

CREATE TABLE IF NOT EXISTS rate_limit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_address TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  hit_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rate_limit
  ON rate_limit_log (ip_address, endpoint, hit_at);

ALTER TABLE mediator_verification ENABLE ROW LEVEL SECURITY;
ALTER TABLE mediator_otp_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE rate_limit_log ENABLE ROW LEVEL SECURITY;
