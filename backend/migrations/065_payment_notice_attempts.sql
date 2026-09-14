-- Durable outbound payment audit; no historical rows are rewritten.
ALTER TABLE payment_reconciliations ADD COLUMN IF NOT EXISTS acknowledgement_response JSONB;
ALTER TABLE payment_reconciliations ADD COLUMN IF NOT EXISTS payment_status_sent VARCHAR(10);
CREATE TABLE IF NOT EXISTS payment_notice_attempts (
  id BIGSERIAL PRIMARY KEY,
  reconciliation_id INTEGER NOT NULL REFERENCES payment_reconciliations(id),
  payment_status VARCHAR(10) NOT NULL CHECK (payment_status IN ('paid','cleared')),
  status VARCHAR(15) NOT NULL CHECK (status IN ('sending','accepted','rejected','unknown')),
  request_bundle JSONB NOT NULL,
  response_bundle JSONB,
  http_status INTEGER,
  errors JSONB,
  receipt_date DATE NOT NULL,
  receipt_reference TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS payment_notice_attempts_reconciliation ON payment_notice_attempts(reconciliation_id, id DESC);
-- Unknown outcomes must be reconciled before a new attempt of the same state.
CREATE UNIQUE INDEX IF NOT EXISTS payment_notice_attempts_once ON payment_notice_attempts(reconciliation_id, payment_status)
  WHERE status IN ('sending','accepted','unknown');
ALTER TABLE payment_reconciliation_details ADD COLUMN IF NOT EXISTS detail_identifier JSONB;
ALTER TABLE payment_reconciliation_details ADD COLUMN IF NOT EXISTS predecessor_identifier JSONB;
-- Distinct unknown money extensions must not collide under the category 'other'.
ALTER TABLE payment_reconciliation_components DROP CONSTRAINT IF EXISTS uq_component_per_detail;
