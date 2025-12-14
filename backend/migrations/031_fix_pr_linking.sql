-- Migration: Fix Payment Reconciliation insurer/provider linking
-- This updates existing records to link them to the correct insurers and providers

-- Update payment_issuer_id based on the identifier stored in the request_bundle
UPDATE payment_reconciliations pr
SET payment_issuer_id = i.insurer_id
FROM insurers i
WHERE pr.payment_issuer_id IS NULL
  AND pr.request_bundle IS NOT NULL
  AND (
    -- Match by identifier value in the paymentIssuer
    i.nphies_id = pr.request_bundle->'entry'->1->'resource'->'paymentIssuer'->'identifier'->>'value'
    OR
    -- Match by display name
    i.insurer_name ILIKE '%' || (pr.request_bundle->'entry'->1->'resource'->'paymentIssuer'->>'display') || '%'
  );

-- Update requestor_id based on the identifier stored in the request_bundle
UPDATE payment_reconciliations pr
SET requestor_id = p.provider_id
FROM providers p
WHERE pr.requestor_id IS NULL
  AND pr.request_bundle IS NOT NULL
  AND (
    -- Match by identifier value in the requestor
    p.nphies_id = pr.request_bundle->'entry'->1->'resource'->'requestor'->'identifier'->>'value'
    OR
    -- Match by display name
    p.provider_name ILIKE '%' || (pr.request_bundle->'entry'->1->'resource'->'requestor'->>'display') || '%'
  );

-- Also try to link by the claim's insurer/provider (for simulated payments)
UPDATE payment_reconciliations pr
SET payment_issuer_id = cs.insurer_id
FROM payment_reconciliation_details prd
JOIN claim_submissions cs ON prd.claim_submission_id = cs.id
WHERE pr.id = prd.reconciliation_id
  AND pr.payment_issuer_id IS NULL
  AND cs.insurer_id IS NOT NULL;

UPDATE payment_reconciliations pr
SET requestor_id = cs.provider_id
FROM payment_reconciliation_details prd
JOIN claim_submissions cs ON prd.claim_submission_id = cs.id
WHERE pr.id = prd.reconciliation_id
  AND pr.requestor_id IS NULL
  AND cs.provider_id IS NOT NULL;

-- Show results
SELECT 
  pr.id,
  pr.payment_issuer_id,
  i.insurer_name,
  pr.requestor_id,
  p.provider_name
FROM payment_reconciliations pr
LEFT JOIN insurers i ON pr.payment_issuer_id = i.insurer_id
LEFT JOIN providers p ON pr.requestor_id = p.provider_id;

