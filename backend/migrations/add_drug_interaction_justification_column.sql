-- Migration: Add drug interaction justification columns to prior_authorizations table
-- Purpose: Store user justification when proceeding with drug interactions or safety warnings
-- Date: 2025-12-10

-- Add drug_interaction_justification column (TEXT to store the justification text)
ALTER TABLE prior_authorizations 
ADD COLUMN IF NOT EXISTS drug_interaction_justification TEXT;

-- Add drug_interaction_justification_date column (TIMESTAMP to track when justification was provided)
ALTER TABLE prior_authorizations 
ADD COLUMN IF NOT EXISTS drug_interaction_justification_date TIMESTAMP;

-- Add comments for documentation
COMMENT ON COLUMN prior_authorizations.drug_interaction_justification IS 'User-provided justification for proceeding with drug interactions or safety warnings';
COMMENT ON COLUMN prior_authorizations.drug_interaction_justification_date IS 'Timestamp when the drug interaction justification was provided';

-- Verification
SELECT 
    'drug_interaction_justification column added' as status,
    column_name,
    data_type
FROM information_schema.columns 
WHERE table_name = 'prior_authorizations' 
AND column_name IN ('drug_interaction_justification', 'drug_interaction_justification_date');

