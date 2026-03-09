-- Migration 058: Add vision_prescription, medication_safety_analysis, and
-- drug_interaction_justification columns to claim_submissions table.
-- These fields are copied from the linked prior_authorization when a claim
-- is created via createFromPriorAuth, so they can be displayed on the
-- Claim Details page (Vision Rx tab, AI Safety Analysis tab).

ALTER TABLE claim_submissions
ADD COLUMN IF NOT EXISTS vision_prescription JSONB;

ALTER TABLE claim_submissions
ADD COLUMN IF NOT EXISTS medication_safety_analysis JSONB;

ALTER TABLE claim_submissions
ADD COLUMN IF NOT EXISTS drug_interaction_justification TEXT;

ALTER TABLE claim_submissions
ADD COLUMN IF NOT EXISTS drug_interaction_justification_date TIMESTAMP;

-- Verify
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'claim_submissions'
AND column_name IN (
    'vision_prescription',
    'medication_safety_analysis',
    'drug_interaction_justification',
    'drug_interaction_justification_date'
);
