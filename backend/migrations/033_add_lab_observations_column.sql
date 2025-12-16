-- Migration: Add lab_observations column to prior_authorizations table
-- Per NPHIES IG: Lab test details MUST be in Observation resources with LOINC codes
-- These are stored as JSONB and referenced via Claim.supportingInfo with category = "laboratory"

-- Add lab_observations column to prior_authorizations table
ALTER TABLE prior_authorizations 
ADD COLUMN IF NOT EXISTS lab_observations JSONB DEFAULT '[]'::jsonb;

-- Add comment for documentation
COMMENT ON COLUMN prior_authorizations.lab_observations IS 'Lab observations with LOINC codes for Professional claims. Per NPHIES IG, lab test details must be in Observation resources, not Claim.item.productOrService. Structure: [{sequence, loinc_code, loinc_display, test_name, value, value_type, unit, unit_code, status, effective_date, note}]';

-- Create index for better query performance on lab observations
CREATE INDEX IF NOT EXISTS idx_prior_authorizations_lab_observations 
ON prior_authorizations USING GIN (lab_observations);

