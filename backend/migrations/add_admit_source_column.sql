-- Migration: Add admit_source column to prior_authorizations table
-- NPHIES: hospitalization.admitSource code
-- Reference: http://nphies.sa/terminology/CodeSystem/admit-source
-- Date: 2025-12-08

-- Add admit_source column to prior_authorizations table
ALTER TABLE prior_authorizations 
ADD COLUMN IF NOT EXISTS admit_source VARCHAR(20);

-- Add comment for documentation
COMMENT ON COLUMN prior_authorizations.admit_source IS 'NPHIES hospitalization.admitSource code (e.g., WKIN, IA, EER, etc.)';
