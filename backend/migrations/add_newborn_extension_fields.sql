-- Migration: Add Newborn Extension Fields to Prior Authorizations
-- NPHIES Test Case 8: Authorization Request for Newborn Patient
-- Reference: https://portal.nphies.sa/ig/StructureDefinition-extension-newborn.html
-- 
-- This migration adds:
-- 1. is_newborn: Boolean flag indicating if the patient is a newborn
-- 2. birth_weight: Birth weight in grams (required for newborn authorizations)

-- Add is_newborn column to prior_authorizations table
ALTER TABLE prior_authorizations 
ADD COLUMN IF NOT EXISTS is_newborn BOOLEAN DEFAULT FALSE;

-- Add birth_weight column to prior_authorizations table (in grams)
ALTER TABLE prior_authorizations 
ADD COLUMN IF NOT EXISTS birth_weight DECIMAL(10, 2);

-- Create index for is_newborn for faster filtering
CREATE INDEX IF NOT EXISTS idx_prior_auth_is_newborn ON prior_authorizations(is_newborn);

-- Add comments for documentation
COMMENT ON COLUMN prior_authorizations.is_newborn IS 'Flag indicating if this is a newborn patient authorization (NPHIES extension-newborn)';
COMMENT ON COLUMN prior_authorizations.birth_weight IS 'Birth weight in grams for newborn patients (required when is_newborn is true)';

