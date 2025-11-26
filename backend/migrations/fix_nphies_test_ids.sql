-- Migration: Fix NPHIES Test IDs
-- Description: Update provider and insurer NPHIES IDs to match NPHIES OBA test environment
-- Reference: https://portal.nphies.sa/ig/Bundle-4350490e-98f0-4c23-9e7d-4cd2c7011959.json.html
-- 
-- IMPORTANT: Run this migration in pgAdmin or via psql to update your database
-- These IDs must match the NPHIES test environment for successful API calls

-- ============================================
-- 1. Update Provider with valid NPHIES test ID
-- ============================================
-- The NPHIES example uses:
--   - Provider NPHIES ID: PR-FHIR
--   - Location License: GACH (General Acute Care Hospital)
--   - Provider Type: 1 (Hospital)

-- First, check if PR-FHIR already exists
-- If it does, just update the location_license on that record
-- If not, update the first provider

-- Update the provider that already has PR-FHIR (if exists) to ensure location_license is set
UPDATE providers 
SET 
    location_license = 'GACH',
    updated_at = CURRENT_TIMESTAMP
WHERE nphies_id = 'PR-FHIR';

-- If no rows were updated (PR-FHIR doesn't exist), update the first provider
-- This uses a DO block to conditionally execute
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM providers WHERE nphies_id = 'PR-FHIR') THEN
        UPDATE providers 
        SET 
            nphies_id = 'PR-FHIR',
            location_license = 'GACH',
            updated_at = CURRENT_TIMESTAMP
        WHERE provider_id = (
            SELECT provider_id 
            FROM providers 
            ORDER BY created_at ASC 
            LIMIT 1
        );
    END IF;
END $$;

-- ============================================
-- 2. Update Insurer with valid NPHIES test ID
-- ============================================
-- The NPHIES example uses:
--   - Insurer NPHIES ID: INS-FHIR

-- Update the insurer that already has INS-FHIR (if exists)
UPDATE insurers
SET 
    updated_at = CURRENT_TIMESTAMP
WHERE nphies_id = 'INS-FHIR';

-- If no rows were updated (INS-FHIR doesn't exist), update the first insurer
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM insurers WHERE nphies_id = 'INS-FHIR') THEN
        UPDATE insurers
        SET 
            nphies_id = 'INS-FHIR',
            updated_at = CURRENT_TIMESTAMP
        WHERE insurer_id = (
            SELECT insurer_id 
            FROM insurers 
            ORDER BY created_at ASC 
            LIMIT 1
        );
    END IF;
END $$;

-- ============================================
-- 3. Verify the updates
-- ============================================
-- Run these SELECT statements to verify the changes

-- Check provider update:
-- SELECT provider_id, provider_name, nphies_id, location_license FROM providers;

-- Check insurer update:
-- SELECT insurer_id, insurer_name, nphies_id FROM insurers;

-- ============================================
-- NOTES
-- ============================================
-- 1. PR-FHIR and INS-FHIR are the NPHIES OBA (On-Boarding Application) test IDs
-- 2. These IDs are used in the official NPHIES documentation examples
-- 3. For production, you must register with NPHIES to get your own licensed IDs
-- 4. The GACH location code represents "General Acute Care Hospital"
-- 5. If you have multiple providers/insurers, update them individually with their 
--    respective NPHIES-registered IDs

-- ============================================
-- ROLLBACK (if needed)
-- ============================================
-- If you need to rollback, update with your previous values:
-- UPDATE providers SET nphies_id = 'YOUR_OLD_ID', location_license = 'YOUR_OLD_LICENSE' WHERE provider_id = X;
-- UPDATE insurers SET nphies_id = 'YOUR_OLD_ID' WHERE insurer_id = X;

