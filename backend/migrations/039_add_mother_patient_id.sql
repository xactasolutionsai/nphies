-- Migration: Add Mother Patient ID for Newborn Requests
-- NPHIES Test Case 8: Newborn Eligibility/Claim/Auth with Mother Coverage
-- Reference: Newborn Elig Request.json example
--
-- When a newborn request is submitted, the newborn patient (with MRN identifier)
-- is associated with the mother's coverage. The mother patient (with Iqama identifier)
-- is the subscriber, and the newborn is the beneficiary with relationship "child".
--
-- This migration adds mother_patient_id columns to track this association.

-- ============================================================================
-- ELIGIBILITY - Add mother_patient_id column
-- ============================================================================

ALTER TABLE eligibility 
ADD COLUMN IF NOT EXISTS mother_patient_id UUID REFERENCES patients(patient_id) ON DELETE SET NULL;

COMMENT ON COLUMN eligibility.mother_patient_id IS 'Reference to mother patient when is_newborn is true. The mother is the subscriber of the coverage, and the newborn (patient_id) is the beneficiary.';

CREATE INDEX IF NOT EXISTS idx_eligibility_mother_patient_id ON eligibility(mother_patient_id);

-- ============================================================================
-- PRIOR AUTHORIZATIONS - Add mother_patient_id column
-- ============================================================================

ALTER TABLE prior_authorizations 
ADD COLUMN IF NOT EXISTS mother_patient_id UUID REFERENCES patients(patient_id) ON DELETE SET NULL;

COMMENT ON COLUMN prior_authorizations.mother_patient_id IS 'Reference to mother patient when is_newborn is true. The mother is the subscriber of the coverage, and the newborn (patient_id) is the beneficiary.';

CREATE INDEX IF NOT EXISTS idx_prior_authorizations_mother_patient_id ON prior_authorizations(mother_patient_id);

-- ============================================================================
-- CLAIM SUBMISSIONS - Add mother_patient_id column
-- ============================================================================

ALTER TABLE claim_submissions 
ADD COLUMN IF NOT EXISTS mother_patient_id UUID REFERENCES patients(patient_id) ON DELETE SET NULL;

COMMENT ON COLUMN claim_submissions.mother_patient_id IS 'Reference to mother patient when is_newborn is true. The mother is the subscriber of the coverage, and the newborn (patient_id) is the beneficiary. Should be copied from prior authorization when creating claim from PA.';

CREATE INDEX IF NOT EXISTS idx_claim_submissions_mother_patient_id ON claim_submissions(mother_patient_id);

-- ============================================================================
-- VERIFICATION
-- ============================================================================
SELECT 
    'Mother patient ID columns added successfully!' as status,
    (SELECT COUNT(*) FROM information_schema.columns 
     WHERE table_name = 'eligibility' AND column_name = 'mother_patient_id') as eligibility_column_exists,
    (SELECT COUNT(*) FROM information_schema.columns 
     WHERE table_name = 'prior_authorizations' AND column_name = 'mother_patient_id') as prior_auth_column_exists,
    (SELECT COUNT(*) FROM information_schema.columns 
     WHERE table_name = 'claim_submissions' AND column_name = 'mother_patient_id') as claim_column_exists;

