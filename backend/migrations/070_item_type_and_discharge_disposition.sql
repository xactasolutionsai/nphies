-- Migration 070: discharge disposition of institutional encounters, and item_type only on pharmacy items.
--
-- 1. discharge_disposition (http://nphies.sa/terminology/CodeSystem/discharge-disposition):
--    NPHIES BV-00759 requires Encounter.hospitalization.dischargeDisposition when the encounter has
--    an end date, and InstitutionalClaimMapper refuses to build such a claim without it. There was
--    no column to store it, so those claims could not be sent. The value is entered by the user
--    (a clinical outcome); it is never defaulted. Nullable columns, existing rows are not changed.
-- 2. item_type ('medication' | 'device') only describes pharmacy items. The columns defaulted to
--    'medication' and the controllers stored 'medication' on every item, so service lines of
--    professional/institutional/dental/vision requests showed a "Medication" badge. The default is
--    removed. Existing rows are NOT changed here: resetting item_type on old non-pharmacy rows is a
--    data change, kept in the opt-in one-off script data_reset_non_pharmacy_item_type.sql.
-- Idempotent.
ALTER TABLE prior_authorizations ADD COLUMN IF NOT EXISTS discharge_disposition VARCHAR(20);
ALTER TABLE claim_submissions ADD COLUMN IF NOT EXISTS discharge_disposition VARCHAR(20);

COMMENT ON COLUMN prior_authorizations.discharge_disposition IS 'Encounter.hospitalization.dischargeDisposition code (http://nphies.sa/terminology/CodeSystem/discharge-disposition), required with an encounter end date (BV-00759)';
COMMENT ON COLUMN claim_submissions.discharge_disposition IS 'Encounter.hospitalization.dischargeDisposition code (http://nphies.sa/terminology/CodeSystem/discharge-disposition), required with an encounter end date (BV-00759)';

ALTER TABLE prior_authorization_items ALTER COLUMN item_type DROP DEFAULT;
ALTER TABLE claim_submission_items ALTER COLUMN item_type DROP DEFAULT;
