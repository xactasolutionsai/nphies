-- Migration: Update NPHIES IDs to match NPHIES test environment
-- Reference: https://portal.nphies.sa/ig/Bundle-4350490e-98f0-4c23-9e7d-4cd2c7011959.html
-- 
-- IMPORTANT: Update these IDs with your actual NPHIES-registered IDs
-- The values below are examples from NPHIES documentation

-- =====================================================
-- UPDATE PROVIDER with NPHIES test environment ID
-- =====================================================
-- The NPHIES example uses 'PR-FHIR' as the provider license ID
-- Update your primary provider with your actual NPHIES provider license ID

UPDATE providers 
SET 
  nphies_id = 'PR-FHIR',
  location_license = 'GACH',
  updated_at = CURRENT_TIMESTAMP
WHERE provider_id = (SELECT provider_id FROM providers ORDER BY created_at ASC LIMIT 1);

-- =====================================================
-- UPDATE INSURER with NPHIES test environment ID
-- =====================================================
-- The NPHIES example uses 'INS-FHIR' as the payer license ID
-- Update your primary insurer with your actual NPHIES payer license ID

UPDATE insurers 
SET 
  nphies_id = 'INS-FHIR',
  updated_at = CURRENT_TIMESTAMP
WHERE insurer_id = (SELECT insurer_id FROM insurers ORDER BY created_at ASC LIMIT 1);

-- =====================================================
-- ADD ADDITIONAL TEST DATA (Optional)
-- =====================================================
-- You can add more test providers/insurers with known NPHIES IDs

-- Example: Add a specific test insurer matching NPHIES documentation
INSERT INTO insurers (insurer_name, nphies_id, status, address)
VALUES (
  'Saudi National Insurance',
  'INS-FHIR',
  'Active',
  'Olaya Street, Building 70, Riyadh Saudi Arabia'
)
ON CONFLICT DO NOTHING;

-- Example: Add a specific test provider matching NPHIES documentation  
INSERT INTO providers (provider_name, nphies_id, type, location_license, address)
VALUES (
  'Saudi General Hospital',
  'PR-FHIR',
  'Hospital',
  'GACH',
  'King Fahd Road, Riyadh, Saudi Arabia'
)
ON CONFLICT DO NOTHING;

-- =====================================================
-- VERIFY UPDATES
-- =====================================================
-- Run these queries to verify the updates:
-- SELECT provider_id, provider_name, nphies_id, location_license FROM providers WHERE nphies_id = 'PR-FHIR';
-- SELECT insurer_id, insurer_name, nphies_id FROM insurers WHERE nphies_id = 'INS-FHIR';

-- =====================================================
-- NOTES
-- =====================================================
-- 1. Replace 'PR-FHIR' with your actual NPHIES Provider License ID
-- 2. Replace 'INS-FHIR' with your actual NPHIES Payer License ID
-- 3. The location_license 'GACH' means "General Acute Care Hospital"
-- 4. These IDs must be registered with NPHIES for requests to be accepted

