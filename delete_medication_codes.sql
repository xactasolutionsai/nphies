-- Delete 4 medication codes from medication_codes table
-- Generated: 2026-05-06
-- All 4 codes verified present in DB before generating this file.
--
-- To verify before running:
--   SELECT id, code, display FROM medication_codes
--   WHERE code IN (
--     '14-1171-2004','7640128011590','96600000003874','06285147014736'
--   );
-- Should return 4 rows.
--
-- To verify after running:
--   SELECT COUNT(*) FROM medication_codes
--   WHERE code IN (
--     '14-1171-2004','7640128011590','96600000003874','06285147014736'
--   );
-- Should return 0.

BEGIN;

DELETE FROM medication_codes
WHERE code IN (
  '14-1171-2004',
  '7640128011590',
  '96600000003874',
  '06285147014736'
);

-- Expected output: DELETE 4
COMMIT;
