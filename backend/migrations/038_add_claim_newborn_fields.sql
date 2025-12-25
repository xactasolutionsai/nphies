-- Migration: Add Newborn Extension Fields to Claim Submissions
-- NPHIES Test Case 8: Claim Request for Newborn Patient
-- Reference: https://portal.nphies.sa/ig/StructureDefinition-extension-newborn.html
--
-- This migration adds support for the newborn extension in claims, matching
-- the functionality that already exists in prior_authorizations table.
--
-- Fields:
-- 1. is_newborn: Boolean flag indicating if the patient is a newborn
-- 2. birth_weight: Birth weight in grams (required for newborn claims, converted to kg for NPHIES)

-- ============================================================================
-- CLAIM SUBMISSIONS - Add newborn extension fields
-- ============================================================================

-- Add is_newborn column to claim_submissions table
ALTER TABLE claim_submissions 
ADD COLUMN IF NOT EXISTS is_newborn BOOLEAN DEFAULT FALSE;

-- Add birth_weight column to claim_submissions table (stored in grams, converted to kg for NPHIES)
ALTER TABLE claim_submissions 
ADD COLUMN IF NOT EXISTS birth_weight DECIMAL(10, 2);

-- Create index for is_newborn for faster filtering
CREATE INDEX IF NOT EXISTS idx_claim_submissions_is_newborn ON claim_submissions(is_newborn);

-- Add comments for documentation
COMMENT ON COLUMN claim_submissions.is_newborn IS 'Flag indicating if this is a newborn patient claim (NPHIES extension-newborn). Should be copied from prior authorization when creating claim from PA.';
COMMENT ON COLUMN claim_submissions.birth_weight IS 'Birth weight in grams for newborn patients (required when is_newborn is true). Converted to kg for NPHIES per BV-00509. Should be copied from prior authorization when creating claim from PA.';

-- ============================================================================
-- VERIFICATION
-- ============================================================================
SELECT 
    'Newborn extension fields added to claim_submissions successfully!' as status,
    (SELECT COUNT(*) FROM information_schema.columns 
     WHERE table_name = 'claim_submissions' 
     AND column_name IN ('is_newborn', 'birth_weight')) as columns_added;

