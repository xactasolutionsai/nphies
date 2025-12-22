-- =====================================================
-- Update PR-FHIR to New Provider ID: 1010613708
-- =====================================================
-- ⚠️  IMPORTANT WARNING: 
-- DO NOT run this migration if your URLs use PR-FHIR!
-- URLs like http://PR-FHIR.com.sa/... should NOT be changed.
-- 
-- This migration is OPTIONAL and should only be run if:
-- 1. You want to update the database provider ID to 1010613708
-- 2. You understand that URLs constructed from provider.nphies_id will change
-- 3. You have updated the code to use NPHIES_CONFIG.PROVIDER_DOMAIN for URLs
--
-- The backend code now uses:
-- - NPHIES_CONFIG.DEFAULT_PROVIDER_ID ('1010613708') for NPHIES identifiers
-- - NPHIES_CONFIG.PROVIDER_DOMAIN ('PR-FHIR') for URL construction
--
-- If you keep 'PR-FHIR' in the database, URLs will work correctly.
-- The new provider ID '1010613708' is used as a fallback when provider.nphies_id is missing.
-- Date: 2025-01-XX
-- =====================================================

-- Step 1: Check current occurrences (for verification)
-- =====================================================
SELECT 
    'providers' as table_name,
    provider_id,
    provider_name,
    nphies_id as current_value
FROM providers 
WHERE nphies_id = 'PR-FHIR' OR nphies_id LIKE 'PR-FHIR%'
ORDER BY provider_name;

-- Step 2: Update providers table
-- =====================================================
-- Update exact match 'PR-FHIR'
UPDATE providers 
SET 
    nphies_id = '1010613708',
    updated_at = CURRENT_TIMESTAMP
WHERE nphies_id = 'PR-FHIR';

-- Update variations like 'PR-FHIR1', 'PR-FHIR2', etc.
-- (Only if you want to update all variations to the same ID)
-- UPDATE providers 
-- SET 
--     nphies_id = '1010613708',
--     updated_at = CURRENT_TIMESTAMP
-- WHERE nphies_id LIKE 'PR-FHIR%';

-- Step 3: Verify the updates
-- =====================================================
SELECT 
    provider_id,
    provider_name,
    nphies_id,
    updated_at
FROM providers 
WHERE nphies_id = '1010613708'
ORDER BY provider_name;

-- Step 4: Check for any remaining PR-FHIR references
-- =====================================================
-- Check providers
SELECT COUNT(*) as remaining_pr_fhir_in_providers
FROM providers 
WHERE nphies_id = 'PR-FHIR' OR nphies_id LIKE 'PR-FHIR%';

-- Check insurers (shouldn't have PR-FHIR, but checking anyway)
SELECT COUNT(*) as pr_fhir_in_insurers
FROM insurers 
WHERE nphies_id = 'PR-FHIR' OR nphies_id LIKE 'PR-FHIR%';

-- =====================================================
-- NOTES:
-- =====================================================
-- ⚠️  RECOMMENDATION: DO NOT RUN THIS MIGRATION
-- 
-- The backend code is configured to:
-- 1. Use NPHIES_CONFIG.DEFAULT_PROVIDER_ID ('1010613708') for NPHIES identifiers
--    when provider.nphies_id is missing/null
-- 2. Use provider.nphies_id (or NPHIES_CONFIG.PROVIDER_DOMAIN) for URL construction
--    to maintain URLs like http://PR-FHIR.com.sa/...
--
-- If you keep 'PR-FHIR' in the database:
-- ✅ URLs will work: http://PR-FHIR.com.sa/...
-- ✅ NPHIES identifiers will use '1010613708' when provider.nphies_id is missing
--
-- If you run this migration and change to '1010613708':
-- ❌ URLs will break: http://1010613708.com.sa/... (invalid domain)
-- ✅ NPHIES identifiers will use '1010613708'
--
-- The best approach: Keep 'PR-FHIR' in the database for URL construction,
-- and let the code use DEFAULT_PROVIDER_ID ('1010613708') as fallback for identifiers.
-- =====================================================

