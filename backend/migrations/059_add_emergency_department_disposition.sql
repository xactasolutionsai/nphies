-- BV-00728: Emergency Department Disposition is required when Encounter is EMER and end date is provided
-- Reference: https://portal.nphies.sa/ig/Encounter-10131.json.html
-- CodeSystem: http://nphies.sa/terminology/CodeSystem/emergency-department-disposition
-- Valid codes: AH, NAD, NAR, DNW, LAOR, DED, DOA, R

ALTER TABLE prior_authorizations ADD COLUMN IF NOT EXISTS emergency_department_disposition VARCHAR(10);
ALTER TABLE claim_submissions ADD COLUMN IF NOT EXISTS emergency_department_disposition VARCHAR(10);
