-- Migration: Add NPHIES Eligibility Extensions Support
-- Date: 2025-11-26
-- Description: Adds columns for Newborn extension, Transfer extension, and Site Eligibility
-- Reference: https://portal.nphies.sa/ig/usecase-eligibility.html

-- Add is_newborn column to patients table
-- Used for newborn eligibility checks where coverage is mother's policy
ALTER TABLE patients ADD COLUMN IF NOT EXISTS is_newborn BOOLEAN DEFAULT FALSE;

-- Add is_transfer column to eligibility table
-- Used for transfer of care requests
ALTER TABLE eligibility ADD COLUMN IF NOT EXISTS is_transfer BOOLEAN DEFAULT FALSE;

-- Add site_eligibility column to eligibility table
-- Stores the Site Eligibility extension code from NPHIES response
-- Possible values: 'eligible', 'not-eligible', 'not-in-network', 'plan-expired', 'coverage-suspended', 'benefit-exhausted'
ALTER TABLE eligibility ADD COLUMN IF NOT EXISTS site_eligibility VARCHAR(50);

-- Create index for site_eligibility for faster filtering
CREATE INDEX IF NOT EXISTS idx_eligibility_site_eligibility ON eligibility(site_eligibility);

-- Create index for is_transfer for faster filtering
CREATE INDEX IF NOT EXISTS idx_eligibility_is_transfer ON eligibility(is_transfer);

-- Create index for is_newborn on patients table
CREATE INDEX IF NOT EXISTS idx_patients_is_newborn ON patients(is_newborn);

-- Add comment descriptions for documentation
COMMENT ON COLUMN patients.is_newborn IS 'Flag indicating if patient is a newborn (eligibility uses mother coverage)';
COMMENT ON COLUMN eligibility.is_transfer IS 'Flag indicating if this is a transfer of care request';
COMMENT ON COLUMN eligibility.site_eligibility IS 'NPHIES Site Eligibility extension response code';

