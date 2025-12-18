-- Migration: Add resubmission columns for prior authorizations
-- Purpose: Support resubmission of rejected/partial prior authorizations per NPHIES requirements
-- When a Prior Authorization is rejected or partially approved, a new PA can be created
-- linked to the original via Claim.related with relationship = "prior"

-- Add is_resubmission flag to indicate this is a resubmission of a rejected/partial PA
ALTER TABLE prior_authorizations 
ADD COLUMN IF NOT EXISTS is_resubmission BOOLEAN DEFAULT FALSE;

-- Add related_claim_identifier to store the original PA's request_number
-- This is used in Claim.related.claim.identifier to link to the previous authorization
ALTER TABLE prior_authorizations 
ADD COLUMN IF NOT EXISTS related_claim_identifier VARCHAR(255);

-- Add comment for documentation
COMMENT ON COLUMN prior_authorizations.is_resubmission IS 'Flag indicating this is a resubmission of a rejected or partially approved prior authorization';
COMMENT ON COLUMN prior_authorizations.related_claim_identifier IS 'The request_number of the original rejected/partial PA being resubmitted. Used in Claim.related.claim.identifier';

-- Create index for querying resubmissions
CREATE INDEX IF NOT EXISTS idx_prior_auth_resubmission ON prior_authorizations(is_resubmission) WHERE is_resubmission = TRUE;
CREATE INDEX IF NOT EXISTS idx_prior_auth_related_claim ON prior_authorizations(related_claim_identifier) WHERE related_claim_identifier IS NOT NULL;

