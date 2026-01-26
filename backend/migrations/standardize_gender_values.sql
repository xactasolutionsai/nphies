-- Migration: Standardize Gender Values
-- Date: 2026-01-26
-- Description: Updates gender values to use only: male, female, other, unknown

-- ============================================
-- STEP 1: Map existing values to new values
-- ============================================
-- This updates all existing gender values to the new standardized values
UPDATE patients SET gender = 
  CASE 
    WHEN LOWER(gender) = 'male' THEN 'male'
    WHEN LOWER(gender) = 'female' THEN 'female'
    WHEN gender = 'A' THEN 'male'      -- Sex changed to Male -> male
    WHEN gender = 'B' THEN 'female'    -- Sex changed to female -> female
    WHEN gender = 'C' THEN 'unknown'   -- Not Completed -> unknown
    WHEN gender = 'U' THEN 'unknown'   -- Undetermined -> unknown
    WHEN gender = 'N' THEN 'other'     -- Undifferentiated -> other
    WHEN LOWER(gender) = 'unknown' THEN 'unknown'
    ELSE 'unknown'                      -- Default fallback
  END
WHERE gender NOT IN ('male', 'female', 'other', 'unknown');

-- ============================================
-- STEP 2: Drop old constraint and add new one
-- ============================================
-- Drop the existing CHECK constraint
ALTER TABLE patients DROP CONSTRAINT IF EXISTS patients_gender_check;

-- Add the new CHECK constraint with standardized values
ALTER TABLE patients ADD CONSTRAINT patients_gender_check 
  CHECK (gender IN ('male', 'female', 'other', 'unknown'));

-- ============================================
-- STEP 3: Verify the changes
-- ============================================
-- Run this query to verify all gender values are now standardized
SELECT gender, COUNT(*) as count 
FROM patients 
GROUP BY gender 
ORDER BY count DESC;
