-- 073: idempotency key for OpenMed analyses, so a repeated submission (double click,
-- network retry) returns the first result instead of running and storing it twice.
-- Additive only: a nullable column and a partial unique index.
BEGIN;
ALTER TABLE openmed_advisory.analyses ADD COLUMN IF NOT EXISTS idempotency_key TEXT
  CHECK (idempotency_key IS NULL OR idempotency_key ~ '^[A-Za-z0-9-]{8,100}$');
CREATE UNIQUE INDEX IF NOT EXISTS openmed_analyses_idempotency
  ON openmed_advisory.analyses (user_id, idempotency_key) WHERE idempotency_key IS NOT NULL;
COMMIT;
