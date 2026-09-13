BEGIN;
-- Preserve legacy integer references; all new selections reference patient_coverage.
ALTER TABLE prior_authorizations ADD COLUMN IF NOT EXISTS selected_coverage_id UUID
  REFERENCES patient_coverage(coverage_id) ON DELETE RESTRICT;
ALTER TABLE claim_submissions ADD COLUMN IF NOT EXISTS selected_coverage_id UUID
  REFERENCES patient_coverage(coverage_id) ON DELETE RESTRICT;
COMMIT;
