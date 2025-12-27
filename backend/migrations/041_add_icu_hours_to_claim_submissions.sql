-- Migration: Add ICU hours column to claim_submissions table
-- For institutional inpatient/daycase encounters with offline eligibility references
-- ICU hours is stored as a numeric value (hours) and included in supportingInfo

-- Add icu_hours column
ALTER TABLE claim_submissions 
ADD COLUMN IF NOT EXISTS icu_hours DECIMAL(10,2);

-- Add comment for documentation
COMMENT ON COLUMN claim_submissions.icu_hours IS 'ICU hours for institutional inpatient/daycase encounters. Stored as decimal (e.g., 24.5 for 24.5 hours). Included in supportingInfo with category "icu-hours" when building FHIR bundle.';

