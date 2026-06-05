CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS mediator_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  is_open BOOLEAN NOT NULL DEFAULT FALSE,
  current_count INTEGER NOT NULL DEFAULT 0 CHECK (current_count >= 0),
  max_count INTEGER NOT NULL DEFAULT 10 CHECK (max_count > 0),
  required_weapon TEXT NOT NULL DEFAULT 'مدفع كريسمس',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO mediator_config (is_open, current_count, max_count, required_weapon)
SELECT FALSE, 6, 6, 'مدفع كريسمس'
WHERE NOT EXISTS (SELECT 1 FROM mediator_config);

CREATE TABLE IF NOT EXISTS mediator_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id TEXT NOT NULL,
  channel_id TEXT UNIQUE NOT NULL,
  message_id TEXT,
  applicant_id TEXT NOT NULL,
  applicant_tag TEXT NOT NULL,
  verified_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'accepted', 'rejected', 'closed')),
  decided_by TEXT,
  decision_notes TEXT,
  rejection_reason TEXT,
  opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  decided_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_mediator_application_open_user
  ON mediator_applications (guild_id, applicant_id)
  WHERE status = 'open';

CREATE INDEX IF NOT EXISTS idx_mediator_application_channel
  ON mediator_applications (channel_id);

CREATE OR REPLACE FUNCTION increment_mediator_count()
RETURNS mediator_config
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  updated_config mediator_config;
BEGIN
  UPDATE mediator_config
  SET
    current_count = LEAST(max_count, current_count + 1),
    updated_at = NOW()
  WHERE id = (SELECT id FROM mediator_config ORDER BY updated_at DESC LIMIT 1)
  RETURNING * INTO updated_config;

  RETURN updated_config;
END;
$$;

ALTER TABLE mediator_verification
  ADD COLUMN IF NOT EXISTS phone_lookup_hash TEXT,
  ADD COLUMN IF NOT EXISTS jwt_jti_hash TEXT,
  ADD COLUMN IF NOT EXISTS jwt_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS discord_avatar_url TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mediator_phone_lookup_hash
  ON mediator_verification (phone_lookup_hash)
  WHERE phone_lookup_hash IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_mediator_jwt_jti_hash
  ON mediator_verification (jwt_jti_hash)
  WHERE jwt_jti_hash IS NOT NULL;

ALTER TABLE mediator_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE mediator_applications ENABLE ROW LEVEL SECURITY;
