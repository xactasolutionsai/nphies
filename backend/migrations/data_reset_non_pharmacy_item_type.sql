-- One-off data fix (opt-in, NOT run by scripts/migrate.js): before migration 070 every item was
-- stored with item_type 'medication'. This resets item_type to NULL on items of non-pharmacy
-- requests so service lines stop showing a "Medication" badge. Pharmacy rows are not changed.
-- Review the counts first:
--   SELECT COUNT(*) FROM prior_authorization_items i JOIN prior_authorizations pa ON pa.id = i.prior_auth_id
--    WHERE pa.auth_type <> 'pharmacy' AND i.item_type IS NOT NULL;
--   SELECT COUNT(*) FROM claim_submission_items i JOIN claim_submissions c ON c.id = i.claim_id
--    WHERE c.claim_type <> 'pharmacy' AND i.item_type IS NOT NULL;
BEGIN;
UPDATE prior_authorization_items i SET item_type = NULL
FROM prior_authorizations pa
WHERE pa.id = i.prior_auth_id AND pa.auth_type <> 'pharmacy' AND i.item_type IS NOT NULL;

UPDATE claim_submission_items i SET item_type = NULL
FROM claim_submissions c
WHERE c.id = i.claim_id AND c.claim_type <> 'pharmacy' AND i.item_type IS NOT NULL;
COMMIT;
