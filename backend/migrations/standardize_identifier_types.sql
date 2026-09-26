-- Migration: Standardize identifier types to HL7/NPHIES standards
-- HL7 v2-0203 types: NI, PRC, PPN, MR (http://terminology.hl7.org/CodeSystem/v2-0203)
-- NPHIES-specific types: BN, DP (http://nphies.sa/terminology/CodeSystem/patient-identifier-type)
-- 
-- Changes:
-- - Removes visitor_permit (VP)
-- - Adds missing NPHIES codes (PRC, BN, DP) to nphies_codes table

BEGIN;

-- =====================================================
-- 1. Remove visitor_permit from patients table
-- =====================================================
-- If you have visitor_permit records, decide how to handle them
-- Option: Set to NULL or another valid type
UPDATE patients 
SET identifier_type = NULL 
WHERE identifier_type = 'visitor_permit';

-- =====================================================
-- 2. policy_holders: only if the table has an identifier_type column
--    (add_policy_holders.sql does not create one, which used to abort this migration)
-- =====================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema = current_schema() AND table_name = 'policy_holders' AND column_name = 'identifier_type') THEN
    UPDATE policy_holders SET identifier_type = NULL WHERE identifier_type = 'visitor_permit';
  END IF;
END $$;

-- =====================================================
-- 3. Update nphies_codes table - remove VP
-- =====================================================
DELETE FROM nphies_codes 
WHERE code = 'VP' 
AND code_system_id = (SELECT code_system_id FROM nphies_code_systems WHERE code = 'identifier-type');

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
