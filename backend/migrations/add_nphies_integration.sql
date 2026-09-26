-- SUPERSEDED: use add_nphies_integration_uuid.sql (applied by `npm run migrate`).
--
-- This file used to create patient_coverage and eligibility.coverage_id with INTEGER
-- keys and pick the "first" provider/insurer with MIN() on UUID columns. Every core
-- table uses UUID keys, so it failed or created mismatching foreign keys. The UUID
-- version contains the same schema changes. Kept as a no-op so old instructions that
-- reference this file cannot damage a database.
SELECT 'add_nphies_integration.sql is superseded by add_nphies_integration_uuid.sql' AS notice;
