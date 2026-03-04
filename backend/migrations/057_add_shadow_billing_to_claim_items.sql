-- Migration: Add shadow billing (dual coding) fields to claim submission items
-- These fields were already present on prior_authorization_items (migration 051)
-- but were missing from claim_submission_items, causing shadow billing data to be
-- lost when creating claims from approved prior authorizations.

-- Add shadow billing columns to claim_submission_items
ALTER TABLE claim_submission_items
  ADD COLUMN IF NOT EXISTS shadow_code VARCHAR(50),
  ADD COLUMN IF NOT EXISTS shadow_code_system VARCHAR(255),
  ADD COLUMN IF NOT EXISTS shadow_code_display VARCHAR(255);

-- Add shadow billing columns to claim_submission_item_details (for package sub-items)
ALTER TABLE claim_submission_item_details
  ADD COLUMN IF NOT EXISTS shadow_code VARCHAR(50),
  ADD COLUMN IF NOT EXISTS shadow_code_system VARCHAR(255),
  ADD COLUMN IF NOT EXISTS shadow_code_display VARCHAR(255);

-- Add pharmacy-specific fields to claim_submission_items that were missing
-- These are needed to properly build pharmacy claim FHIR bundles
ALTER TABLE claim_submission_items
  ADD COLUMN IF NOT EXISTS prescribed_medication_code VARCHAR(50),
  ADD COLUMN IF NOT EXISTS pharmacist_selection_reason VARCHAR(50),
  ADD COLUMN IF NOT EXISTS pharmacist_substitute VARCHAR(50);

COMMENT ON COLUMN claim_submission_items.shadow_code IS 'Provider internal product/service code for dual coding (shadow billing)';
COMMENT ON COLUMN claim_submission_items.shadow_code_system IS 'Code system URL for the shadow code';
COMMENT ON COLUMN claim_submission_items.shadow_code_display IS 'Display text for the shadow code';
COMMENT ON COLUMN claim_submission_items.prescribed_medication_code IS 'Originally prescribed medication code (pharmacy claims)';
COMMENT ON COLUMN claim_submission_items.pharmacist_selection_reason IS 'Reason for pharmacist medication selection (pharmacy claims)';
COMMENT ON COLUMN claim_submission_items.pharmacist_substitute IS 'Pharmacist substitute code (pharmacy claims)';

COMMENT ON COLUMN claim_submission_item_details.shadow_code IS 'Provider internal product/service code for dual coding (shadow billing)';
COMMENT ON COLUMN claim_submission_item_details.shadow_code_system IS 'Code system URL for the shadow code';
COMMENT ON COLUMN claim_submission_item_details.shadow_code_display IS 'Display text for the shadow code';
