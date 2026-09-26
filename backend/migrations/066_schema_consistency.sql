-- Migration 066: columns the application reads or writes that no earlier migration creates.
-- Idempotent (ADD COLUMN IF NOT EXISTS); types mirror the matching claim_submissions /
-- prior_authorizations columns so the PA -> claim copy keeps the same shape.
--
-- Verified against: controllers/priorAuthorizationsController.js (list/detail SELECTs and the
-- response UPDATE), services/messageUpdater.js and services/communicationService.js
-- (adjudication_outcome), models/schema.js priorAuthorization/claimSubmission keys (inserted as
-- columns) and models/claimInput.js (ventilation_hours).

-- prior_authorizations: adjudication summary written from ClaimResponse
ALTER TABLE prior_authorizations ADD COLUMN IF NOT EXISTS adjudication_outcome VARCHAR(20);
ALTER TABLE prior_authorizations ADD COLUMN IF NOT EXISTS eligible_amount DECIMAL(12,2);
ALTER TABLE prior_authorizations ADD COLUMN IF NOT EXISTS benefit_amount DECIMAL(12,2);
ALTER TABLE prior_authorizations ADD COLUMN IF NOT EXISTS copay_amount DECIMAL(12,2);

-- prior_authorizations: encounter / eligibility fields accepted by the form and sent by the mappers
ALTER TABLE prior_authorizations ADD COLUMN IF NOT EXISTS sub_type VARCHAR(10);
ALTER TABLE prior_authorizations ADD COLUMN IF NOT EXISTS triage_category VARCHAR(10);
ALTER TABLE prior_authorizations ADD COLUMN IF NOT EXISTS triage_date TIMESTAMP;
ALTER TABLE prior_authorizations ADD COLUMN IF NOT EXISTS encounter_priority VARCHAR(10);
ALTER TABLE prior_authorizations ADD COLUMN IF NOT EXISTS eligibility_offline_ref VARCHAR(100);
ALTER TABLE prior_authorizations ADD COLUMN IF NOT EXISTS eligibility_response_id VARCHAR(100);
ALTER TABLE prior_authorizations ADD COLUMN IF NOT EXISTS eligibility_response_system VARCHAR(255);
ALTER TABLE prior_authorizations ADD COLUMN IF NOT EXISTS ventilation_hours DECIMAL(10,2);

-- claim_submissions: fields accepted by the claim schema and used by the institutional mapper
ALTER TABLE claim_submissions ADD COLUMN IF NOT EXISTS ventilation_hours DECIMAL(10,2);
ALTER TABLE claim_submissions ADD COLUMN IF NOT EXISTS admit_source VARCHAR(20);
ALTER TABLE claim_submissions ADD COLUMN IF NOT EXISTS pre_auth_period_start DATE;
ALTER TABLE claim_submissions ADD COLUMN IF NOT EXISTS pre_auth_period_end DATE;

-- No CHECK on adjudication_outcome: the value comes from the insurer's extension and an
-- unexpected code must not make the response update fail.
COMMENT ON COLUMN prior_authorizations.ventilation_hours IS 'Mechanical ventilation hours (institutional supportingInfo ventilation-hours)';
COMMENT ON COLUMN claim_submissions.ventilation_hours IS 'Mechanical ventilation hours (institutional supportingInfo ventilation-hours)';

-- Diagnoses: NPHIES expects ICD-10-AM (services/priorAuthMapper/nphiesIdentity.js ICD10_SYSTEM);
-- align the prior-authorization default with claim_submission_diagnoses. Existing rows are not rewritten.
ALTER TABLE prior_authorization_diagnoses ALTER COLUMN diagnosis_system SET DEFAULT 'http://hl7.org/fhir/sid/icd-10-am';

-- provider-type code table: create_nphies_code_tables.sql seeded 2=Clinic, 4=Laboratory, 5=Dental,
-- contradicting add_nphies_example_providers.sql and NPHIES examples (5 = Clinic).
UPDATE nphies_codes nc
SET display_en = v.display_en, updated_at = CURRENT_TIMESTAMP
FROM nphies_code_systems cs,
     (VALUES ('2', 'Polyclinic'), ('4', 'Optical Shop'), ('5', 'Clinic')) AS v(code, display_en)
WHERE cs.code = 'provider-type' AND nc.code_system_id = cs.code_system_id
  AND nc.code = v.code AND nc.display_en IS DISTINCT FROM v.display_en;
