-- Migration: Add practice_code and service_event_type columns to prior_authorizations
-- Date: 2024-12-04
-- Description: Add NPHIES careTeam.qualification (practice_code) and dental service event type

-- Add practice_code column (NPHIES practice codes like '08.00', '11.00', '22.00')
ALTER TABLE prior_authorizations 
ADD COLUMN IF NOT EXISTS practice_code VARCHAR(20);

-- Add service_event_type column (NPHIES dental claims: ICSE for initial, SCSE for subsequent)
ALTER TABLE prior_authorizations 
ADD COLUMN IF NOT EXISTS service_event_type VARCHAR(10);

-- Add comment for documentation
COMMENT ON COLUMN prior_authorizations.practice_code IS 'NPHIES practice code for careTeam.qualification (e.g., 08.00 for Internal Medicine, 11.00 for Ophthalmology)';
COMMENT ON COLUMN prior_authorizations.service_event_type IS 'NPHIES dental service event type: ICSE (Initial Clinical Service Event) or SCSE (Subsequent Clinical Service Event)';

-- Set default practice_code for existing records (Internal Medicine as default)
UPDATE prior_authorizations 
SET practice_code = '08.00' 
WHERE practice_code IS NULL;

