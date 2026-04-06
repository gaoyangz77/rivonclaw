CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS users (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id    TEXT UNIQUE NOT NULL,
  jwt_secret   TEXT NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  credits_init BOOLEAN NOT NULL DEFAULT false
);

CREATE TABLE IF NOT EXISTS credit_ledger (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id),
  delta      INTEGER NOT NULL,
  reason     TEXT NOT NULL CHECK (reason IN ('signup_bonus', 'consumption', 'recharge')),
  model      TEXT,
  tokens     INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS credit_balance (
  user_id    UUID PRIMARY KEY REFERENCES users(id),
  balance    INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for fast history queries
CREATE INDEX IF NOT EXISTS idx_ledger_user_created ON credit_ledger(user_id, created_at DESC);
