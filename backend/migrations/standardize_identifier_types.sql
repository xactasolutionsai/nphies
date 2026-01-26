-- Migration: Standardize identifier types to HL7/NPHIES standards
-- HL7 v2-0203 types: NI, PRC, PPN, VS, MR (http://terminology.hl7.org/CodeSystem/v2-0203)
-- NPHIES-specific types: BN, DP (http://nphies.sa/terminology/CodeSystem/patient-identifier-type)
-- 
-- Changes:
-- - Removes visitor_permit (VP) and replaces with visa (VS)
-- - Adds missing NPHIES codes (PRC, BN, DP) to nphies_codes table

BEGIN;

-- =====================================================
-- 1. Update patients table - convert visitor_permit to visa
-- =====================================================
UPDATE patients 
SET identifier_type = 'visa' 
WHERE identifier_type = 'visitor_permit';

-- =====================================================
-- 2. Update policy_holders table - convert visitor_permit to visa
-- =====================================================
UPDATE policy_holders 
SET identifier_type = 'visa' 
WHERE identifier_type = 'visitor_permit';

-- =====================================================
-- 3. Update nphies_codes table - remove VP, add VS
-- =====================================================
DELETE FROM nphies_codes 
WHERE code = 'VP' 
AND code_system_id = (SELECT code_system_id FROM nphies_code_systems WHERE code = 'identifier-type');

INSERT INTO nphies_codes (code_system_id, code, display_en, sort_order)
SELECT cs.code_system_id, 'VS', 'Visa', 3
FROM nphies_code_systems cs
WHERE cs.code = 'identifier-type'
ON CONFLICT (code_system_id, code) DO UPDATE SET display_en = EXCLUDED.display_en;

-- =====================================================
-- 4. Add missing NPHIES codes (PRC, BN, DP)
-- =====================================================
INSERT INTO nphies_codes (code_system_id, code, display_en, sort_order)
SELECT cs.code_system_id, v.code, v.display_en, v.sort_order
FROM nphies_code_systems cs
CROSS JOIN (VALUES
    ('PRC', 'Permanent Resident Card (Iqama)', 6),
    ('BN', 'Border Number', 7),
    ('DP', 'Displaced Person', 8)
) AS v(code, display_en, sort_order)
WHERE cs.code = 'identifier-type'
ON CONFLICT (code_system_id, code) DO UPDATE SET display_en = EXCLUDED.display_en;

COMMIT;
