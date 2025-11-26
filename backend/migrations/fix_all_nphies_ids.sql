-- ============================================
-- COMPREHENSIVE NPHIES ID FIX
-- ============================================
-- This migration updates all providers and insurers with valid NPHIES test IDs
-- Reference: https://portal.nphies.sa/ig/Bundle-4350490e-98f0-4c23-9e7d-4cd2c7011959.json.html
--
-- IMPORTANT: For testing, NPHIES OBA environment uses:
--   - Provider: PR-FHIR
--   - Insurer: INS-FHIR
--   - Location: GACH (General Acute Care Hospital)
--
-- Run this in pgAdmin to fix your database
-- ============================================

-- ============================================
-- 1. FIX PROVIDERS
-- ============================================

-- Update "Dallah Hospital" - this is the one you're testing with
UPDATE providers 
SET 
    nphies_id = 'PR-FHIR',
    location_license = 'GACH',
    updated_at = CURRENT_TIMESTAMP
WHERE provider_name = 'Dallah Hospital';

-- Update other providers with fake IDs to use PR-FHIR pattern
-- (In production, each provider needs their own registered NPHIES ID)
UPDATE providers 
SET 
    location_license = 'GACH',
    updated_at = CURRENT_TIMESTAMP
WHERE location_license IS NULL;

-- ============================================
-- 2. FIX INSURERS
-- ============================================

-- For testing, all insurers should use INS-FHIR
-- Update Tawuniya (which you might be using for testing)
UPDATE insurers 
SET 
    nphies_id = 'INS-FHIR',
    updated_at = CURRENT_TIMESTAMP
WHERE insurer_name = 'Tawuniya';

-- Also update MedGulf
UPDATE insurers 
SET 
    nphies_id = 'INS-FHIR',
    updated_at = CURRENT_TIMESTAMP
WHERE insurer_name = 'MedGulf';

-- ============================================
-- 3. VERIFY THE CHANGES
-- ============================================

-- Run these queries to verify:

-- Check providers:
SELECT provider_id, provider_name, nphies_id, location_license 
FROM providers 
WHERE nphies_id IN ('PR-FHIR', 'INS-FHIR') OR location_license = 'GACH';

-- Check insurers:
SELECT insurer_id, insurer_name, nphies_id 
FROM insurers 
WHERE nphies_id = 'INS-FHIR';

-- ============================================
-- QUICK FIX FOR TESTING
-- ============================================
-- If you just want to quickly fix the provider/insurer you're using:

-- Option A: Use the existing valid records
-- King Faisal Specialist Hospital already has PR-FHIR
-- Bupa Arabia already has INS-FHIR

-- Option B: Update Dallah Hospital specifically
-- UPDATE providers SET nphies_id = 'PR-FHIR', location_license = 'GACH' WHERE provider_name = 'Dallah Hospital';

-- ============================================
-- NOTES
-- ============================================
-- 1. For NPHIES OBA (test environment), use PR-FHIR and INS-FHIR
-- 2. For production, you need real NPHIES-registered IDs for each provider/insurer
-- 3. The location_license 'GACH' means "General Acute Care Hospital"
-- 4. Make sure to restart your backend after running this migration

