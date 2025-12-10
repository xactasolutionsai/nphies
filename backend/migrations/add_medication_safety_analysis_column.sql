-- Migration: Add medication_safety_analysis column to prior_authorizations table
-- Purpose: Store AI-generated medication safety analysis for pharmacy prior authorizations
-- Date: 2025-12-10

-- Add medication_safety_analysis column (JSONB to store structured analysis data)
ALTER TABLE prior_authorizations 
ADD COLUMN IF NOT EXISTS medication_safety_analysis JSONB;

-- Add comment for documentation
COMMENT ON COLUMN prior_authorizations.medication_safety_analysis IS 'AI-generated medication safety analysis (drug interactions, warnings, side effects) for pharmacy authorizations';

-- Create index for querying safety analysis (optional, for performance)
CREATE INDEX IF NOT EXISTS idx_prior_auth_medication_safety 
ON prior_authorizations USING GIN (medication_safety_analysis) 
WHERE medication_safety_analysis IS NOT NULL;

-- Verification
SELECT 
    'medication_safety_analysis column added successfully!' as status,
    column_name, 
    data_type 
FROM information_schema.columns 
WHERE table_name = 'prior_authorizations' 
AND column_name = 'medication_safety_analysis';

