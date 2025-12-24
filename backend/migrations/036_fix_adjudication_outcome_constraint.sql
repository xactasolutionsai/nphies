-- Migration: Fix adjudication_outcome constraint to allow 'pended' and NULL
-- The constraint was missing 'pended' which is used when priority is 'deferred'
-- Also ensure NULL is explicitly allowed (CHECK constraints allow NULL by default, but being explicit)

-- ============================================================================
-- CLAIM SUBMISSIONS - Update adjudication_outcome constraint
-- ============================================================================

-- Drop the old constraint(s) - PostgreSQL may have auto-generated different names
DO $$
DECLARE
    constraint_name text;
BEGIN
    -- Find and drop any existing CHECK constraint on adjudication_outcome
    FOR constraint_name IN 
        SELECT conname 
        FROM pg_constraint 
        WHERE conrelid = 'claim_submissions'::regclass 
        AND contype = 'c' 
        AND conname LIKE '%adjudication_outcome%'
    LOOP
        EXECUTE 'ALTER TABLE claim_submissions DROP CONSTRAINT IF EXISTS ' || constraint_name;
    END LOOP;
END $$;

-- Add the new constraint that allows 'approved', 'rejected', 'partial', 'pended', and NULL
ALTER TABLE claim_submissions 
ADD CONSTRAINT claim_submissions_adjudication_outcome_check 
CHECK (adjudication_outcome IS NULL OR adjudication_outcome IN ('approved', 'rejected', 'partial', 'pended'));

COMMENT ON COLUMN claim_submissions.adjudication_outcome IS 'Adjudication outcome: approved, rejected, partial, or pended (for deferred priority claims). NULL for draft/pending claims.';

-- ============================================================================
-- VERIFICATION
-- ============================================================================
SELECT 
    'Adjudication outcome constraint updated successfully!' as status,
    (SELECT constraint_name FROM information_schema.table_constraints 
     WHERE table_name = 'claim_submissions' 
     AND constraint_name = 'claim_submissions_adjudication_outcome_check') as constraint_exists;

