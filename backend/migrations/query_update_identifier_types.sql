-- =====================================================
-- Query Tool: Update Identifier Types in Database
-- =====================================================
-- This script helps you inspect and update identifier_type values
-- Run these queries individually to check and update your data
-- =====================================================

-- =====================================================
-- STEP 1: Check current distribution of identifier types
-- =====================================================
SELECT 
    identifier_type, 
    COUNT(*) as count 
FROM patients 
GROUP BY identifier_type 
ORDER BY count DESC;

-- =====================================================
-- STEP 2: Check for any visitor_permit records that need updating
-- =====================================================
SELECT 
    patient_id, 
    name, 
    identifier, 
    identifier_type 
FROM patients 
WHERE identifier_type = 'visitor_permit';

-- =====================================================
-- STEP 3: Remove visitor_permit from patients table (set to NULL)
-- =====================================================
UPDATE patients 
SET identifier_type = NULL 
WHERE identifier_type = 'visitor_permit';

-- =====================================================
-- STEP 4: Remove visitor_permit from policy_holders table
-- =====================================================
UPDATE policy_holders 
SET identifier_type = NULL 
WHERE identifier_type = 'visitor_permit';

-- =====================================================
-- STEP 5: Verify changes - check distribution again
-- =====================================================
SELECT 
    identifier_type, 
    COUNT(*) as count 
FROM patients 
GROUP BY identifier_type 
ORDER BY count DESC;

-- =====================================================
-- STEP 6: Check for any invalid identifier types
-- Valid types: national_id, iqama, passport, mrn, border_number, displaced_person
-- =====================================================
SELECT 
    patient_id, 
    name, 
    identifier, 
    identifier_type 
FROM patients 
WHERE identifier_type NOT IN ('national_id', 'iqama', 'passport', 'mrn', 'border_number', 'displaced_person')
AND identifier_type IS NOT NULL 
AND identifier_type != '';

-- =====================================================
-- OPTIONAL: View nphies_codes for identifier-type
-- =====================================================
SELECT 
    nc.code, 
    nc.display_en, 
    nc.sort_order 
FROM nphies_codes nc
JOIN nphies_code_systems ncs ON nc.code_system_id = ncs.code_system_id
WHERE ncs.code = 'identifier-type'
ORDER BY nc.sort_order;
