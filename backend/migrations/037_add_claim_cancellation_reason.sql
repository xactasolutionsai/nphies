-- Migration: Add cancellation_reason column to claim_submissions
-- This allows storing the cancellation reason code (WI, NP, TAS, SU, resubmission)
-- when a claim is cancelled, matching the functionality in prior_authorizations table

-- ============================================================================
-- CLAIM SUBMISSIONS - Add cancellation_reason column
-- ============================================================================

ALTER TABLE claim_submissions 
ADD COLUMN IF NOT EXISTS cancellation_reason TEXT;

COMMENT ON COLUMN claim_submissions.cancellation_reason IS 'Cancellation reason code: WI (Wrong Information), NP (Service Not Performed), TAS (Transaction Already Submitted), SU (Service Unavailable), or resubmission (Claim Re-submission)';

-- ============================================================================
-- VERIFICATION
-- ============================================================================
SELECT 
    'Cancellation reason column added successfully!' as status,
    (SELECT COUNT(*) FROM information_schema.columns 
     WHERE table_name = 'claim_submissions' 
     AND column_name = 'cancellation_reason') as column_exists;

