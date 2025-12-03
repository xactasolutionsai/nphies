-- Migration: Add vision_prescription column to prior_authorizations table
-- This column stores vision prescription data for vision auth types (lensSpecification, etc.)
-- Run this in pgAdmin Query Tool on your existing database

-- Add vision_prescription JSONB column to prior_authorizations
ALTER TABLE prior_authorizations
ADD COLUMN IF NOT EXISTS vision_prescription JSONB;

-- Add encounter_identifier column if not exists (for NPHIES IC-00183 compliance)
ALTER TABLE prior_authorizations
ADD COLUMN IF NOT EXISTS encounter_identifier VARCHAR(255);

-- Add service_type column if not exists (for NPHIES encounter serviceType)
ALTER TABLE prior_authorizations
ADD COLUMN IF NOT EXISTS service_type VARCHAR(100);

-- Add comment for documentation
COMMENT ON COLUMN prior_authorizations.vision_prescription IS 'JSONB storing vision prescription data including product_type, date_written, prescriber_license, right_eye and left_eye specifications (sphere, cylinder, axis, add, prism)';

-- Verify the column was added
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'prior_authorizations' 
AND column_name IN ('vision_prescription', 'encounter_identifier', 'service_type');

