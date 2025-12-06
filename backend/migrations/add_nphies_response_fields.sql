-- Migration: Add missing NPHIES response fields
-- Date: 2025-12-06
-- Description: Adds columns to store additional NPHIES response data that was not being captured

-- ============================================
-- 1. Add item-level adjudication columns
-- ============================================
-- These store the detailed adjudication breakdown per item

ALTER TABLE prior_authorization_items 
ADD COLUMN IF NOT EXISTS adjudication_eligible_amount NUMERIC;

ALTER TABLE prior_authorization_items 
ADD COLUMN IF NOT EXISTS adjudication_copay_amount NUMERIC;

ALTER TABLE prior_authorization_items 
ADD COLUMN IF NOT EXISTS adjudication_approved_quantity NUMERIC;

-- Add comment for documentation
COMMENT ON COLUMN prior_authorization_items.adjudication_eligible_amount IS 'NPHIES item-level eligible amount from adjudication';
COMMENT ON COLUMN prior_authorization_items.adjudication_copay_amount IS 'NPHIES item-level copay amount from adjudication';
COMMENT ON COLUMN prior_authorization_items.adjudication_approved_quantity IS 'NPHIES approved quantity from adjudication';

-- ============================================
-- 2. Add MessageHeader tracking columns
-- ============================================
-- These store NPHIES message exchange details

ALTER TABLE prior_authorizations
ADD COLUMN IF NOT EXISTS nphies_message_id VARCHAR(255);

ALTER TABLE prior_authorizations
ADD COLUMN IF NOT EXISTS nphies_response_code VARCHAR(50);

ALTER TABLE prior_authorizations
ADD COLUMN IF NOT EXISTS original_request_identifier VARCHAR(255);

-- Add comment for documentation
COMMENT ON COLUMN prior_authorizations.nphies_message_id IS 'NPHIES MessageHeader ID from response';
COMMENT ON COLUMN prior_authorizations.nphies_response_code IS 'NPHIES response code (ok, transient-error, fatal-error)';
COMMENT ON COLUMN prior_authorizations.original_request_identifier IS 'Original request identifier echoed back in response';

-- ============================================
-- 3. Add insurance details columns
-- ============================================
-- These store insurance-related response data

ALTER TABLE prior_authorizations
ADD COLUMN IF NOT EXISTS insurance_sequence INTEGER;

ALTER TABLE prior_authorizations
ADD COLUMN IF NOT EXISTS insurance_focal BOOLEAN;

COMMENT ON COLUMN prior_authorizations.insurance_sequence IS 'Insurance sequence number from ClaimResponse';
COMMENT ON COLUMN prior_authorizations.insurance_focal IS 'Whether this is the focal insurance';

-- ============================================
-- 4. Add ClaimResponse metadata columns
-- ============================================
-- These store additional ClaimResponse fields

ALTER TABLE prior_authorizations
ADD COLUMN IF NOT EXISTS claim_response_status VARCHAR(50);

ALTER TABLE prior_authorizations
ADD COLUMN IF NOT EXISTS claim_response_use VARCHAR(50);

ALTER TABLE prior_authorizations
ADD COLUMN IF NOT EXISTS claim_response_created DATE;

COMMENT ON COLUMN prior_authorizations.claim_response_status IS 'ClaimResponse status (active, cancelled, draft, entered-in-error)';
COMMENT ON COLUMN prior_authorizations.claim_response_use IS 'ClaimResponse use (claim, preauthorization, predetermination)';
COMMENT ON COLUMN prior_authorizations.claim_response_created IS 'ClaimResponse created date';

-- ============================================
-- Verify columns were added
-- ============================================
-- Run this to verify:
-- SELECT column_name, data_type FROM information_schema.columns 
-- WHERE table_name IN ('prior_authorizations', 'prior_authorization_items')
-- AND column_name IN ('adjudication_eligible_amount', 'adjudication_copay_amount', 
--                     'adjudication_approved_quantity', 'nphies_message_id', 
--                     'nphies_response_code', 'original_request_identifier',
--                     'insurance_sequence', 'insurance_focal',
--                     'claim_response_status', 'claim_response_use', 'claim_response_created');
