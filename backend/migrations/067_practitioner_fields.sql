-- Migration 067: treating practitioner of a prior authorization / claim.
-- Replaces the placeholder practitioner (PRACT-xxxx / 'Healthcare Provider') the mappers
-- used to send: the Practitioner resource and careTeam are now built from these values,
-- and the mappers reject professional, institutional, dental and vision requests without them.
-- Additive and idempotent: nullable columns, existing rows are not changed.
ALTER TABLE prior_authorizations ADD COLUMN IF NOT EXISTS practitioner_license VARCHAR(50);
ALTER TABLE prior_authorizations ADD COLUMN IF NOT EXISTS practitioner_name VARCHAR(255);
ALTER TABLE prior_authorizations ADD COLUMN IF NOT EXISTS practitioner_specialty_code VARCHAR(20);
ALTER TABLE prior_authorizations ADD COLUMN IF NOT EXISTS practitioner_identifier_type VARCHAR(10);

ALTER TABLE claim_submissions ADD COLUMN IF NOT EXISTS practitioner_license VARCHAR(50);
ALTER TABLE claim_submissions ADD COLUMN IF NOT EXISTS practitioner_name VARCHAR(255);
ALTER TABLE claim_submissions ADD COLUMN IF NOT EXISTS practitioner_specialty_code VARCHAR(20);
ALTER TABLE claim_submissions ADD COLUMN IF NOT EXISTS practitioner_identifier_type VARCHAR(10);

COMMENT ON COLUMN prior_authorizations.practitioner_license IS 'Treating practitioner license (Practitioner.identifier, http://nphies.sa/license/practitioner-license)';
COMMENT ON COLUMN claim_submissions.practitioner_license IS 'Treating practitioner license (Practitioner.identifier, http://nphies.sa/license/practitioner-license)';
