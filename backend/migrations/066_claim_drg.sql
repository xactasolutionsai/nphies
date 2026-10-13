BEGIN;
ALTER TABLE claim_submissions
  ADD COLUMN IF NOT EXISTS drg_code VARCHAR(10),
  ADD COLUMN IF NOT EXISTS drg_description TEXT,
  ADD COLUMN IF NOT EXISTS drg_code_system VARCHAR(255),
  ADD COLUMN IF NOT EXISTS drg_version VARCHAR(10),
  ADD COLUMN IF NOT EXISTS drg_grouper_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS drg_grouper_version VARCHAR(50),
  ADD COLUMN IF NOT EXISTS drg_grouper_certified BOOLEAN,
  ADD COLUMN IF NOT EXISTS drg_mds_confirmed BOOLEAN,
  ADD COLUMN IF NOT EXISTS drg_grouper_output JSONB,
  ADD COLUMN IF NOT EXISTS drg_error_explanation TEXT,
  ADD COLUMN IF NOT EXISTS drg_leave_days INTEGER CHECK (drg_leave_days >= 0),
  ADD COLUMN IF NOT EXISTS drg_ventilation_used BOOLEAN,
  ADD COLUMN IF NOT EXISTS drg_no_procedures BOOLEAN,
  ADD COLUMN IF NOT EXISTS drg_procedures JSONB,
  ADD COLUMN IF NOT EXISTS discharge_disposition VARCHAR(30),
  ADD COLUMN IF NOT EXISTS ventilation_hours NUMERIC(10,2);

CREATE TABLE IF NOT EXISTS claim_drg_audit (
  id BIGSERIAL PRIMARY KEY,
  claim_id INTEGER NOT NULL REFERENCES claim_submissions(id) ON DELETE CASCADE,
  previous_code VARCHAR(10),
  new_code VARCHAR(10),
  justification TEXT,
  cds_reviewer VARCHAR(255),
  coding_reviewer VARCHAR(255),
  changed_by TEXT,
  snapshot JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS claim_drg_audit_claim_idx ON claim_drg_audit(claim_id);
COMMIT;
