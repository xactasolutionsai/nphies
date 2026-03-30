-- ============================================================================
-- Migration: Add Authorization Offline Fields
-- ============================================================================
-- Adds authorization_offline_date and authorization_offline_reference to both
-- prior_authorizations and claim_submissions tables.
--
-- Per NPHIES spec: when authorization was obtained offline (phone/portal),
-- the provider must include extension-authorization-offline-date and the
-- offline reference in the claim bundle.
-- ============================================================================

ALTER TABLE prior_authorizations
  ADD COLUMN IF NOT EXISTS authorization_offline_date TIMESTAMP,
  ADD COLUMN IF NOT EXISTS authorization_offline_reference VARCHAR(255);

ALTER TABLE claim_submissions
  ADD COLUMN IF NOT EXISTS authorization_offline_date TIMESTAMP,
  ADD COLUMN IF NOT EXISTS authorization_offline_reference VARCHAR(255);

-- ============================================================================
-- VERIFICATION
-- ============================================================================
SELECT
  'Authorization Offline Fields Migration completed successfully!' AS status,
  EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'prior_authorizations' AND column_name = 'authorization_offline_date'
  ) AS pa_offline_date_exists,
  EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'prior_authorizations' AND column_name = 'authorization_offline_reference'
  ) AS pa_offline_ref_exists,
  EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'claim_submissions' AND column_name = 'authorization_offline_date'
  ) AS cs_offline_date_exists,
  EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'claim_submissions' AND column_name = 'authorization_offline_reference'
  ) AS cs_offline_ref_exists;
