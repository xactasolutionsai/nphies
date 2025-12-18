-- Migration: Add manual entry fields for pharmacy items
-- Date: 2025-12-18
-- Description: Adds fields to track manual code entry for pharmacy medications

-- Add medication_name column (to store the name when manually entered)
ALTER TABLE prior_authorization_items 
ADD COLUMN IF NOT EXISTS medication_name VARCHAR(500);

-- Add manual_code_entry flag (to track if medication code was manually entered)
ALTER TABLE prior_authorization_items 
ADD COLUMN IF NOT EXISTS manual_code_entry BOOLEAN DEFAULT FALSE;

-- Add manual_prescribed_code_entry flag (for prescribed medication code)
ALTER TABLE prior_authorization_items 
ADD COLUMN IF NOT EXISTS manual_prescribed_code_entry BOOLEAN DEFAULT FALSE;

-- Add prescribed_medication_code column (if not exists)
ALTER TABLE prior_authorization_items 
ADD COLUMN IF NOT EXISTS prescribed_medication_code VARCHAR(50);

-- Add pharmacist_selection_reason column (if not exists)
ALTER TABLE prior_authorization_items 
ADD COLUMN IF NOT EXISTS pharmacist_selection_reason VARCHAR(50);

-- Add pharmacist_substitute column (if not exists)
ALTER TABLE prior_authorization_items 
ADD COLUMN IF NOT EXISTS pharmacist_substitute VARCHAR(50);

-- Add patient_share column (if not exists)
ALTER TABLE prior_authorization_items 
ADD COLUMN IF NOT EXISTS patient_share DECIMAL(12,2);

-- Add is_package flag (if not exists)
ALTER TABLE prior_authorization_items 
ADD COLUMN IF NOT EXISTS is_package BOOLEAN DEFAULT FALSE;

-- Add is_maternity flag (if not exists)
ALTER TABLE prior_authorization_items 
ADD COLUMN IF NOT EXISTS is_maternity BOOLEAN DEFAULT FALSE;

-- Comment on columns
COMMENT ON COLUMN prior_authorization_items.medication_name IS 'Medication display name (auto-filled from search or manually entered)';
COMMENT ON COLUMN prior_authorization_items.manual_code_entry IS 'True if medication code was manually entered instead of selected from database';
COMMENT ON COLUMN prior_authorization_items.manual_prescribed_code_entry IS 'True if prescribed medication code was manually entered';

