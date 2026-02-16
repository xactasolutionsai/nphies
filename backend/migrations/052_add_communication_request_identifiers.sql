-- Migration: Add identifier columns to nphies_communication_requests
-- These columns store the CommunicationRequest's own identifier and the about identifier
-- needed to correctly build solicited Communication bundles

-- about_identifier: The identifier.value from the CommunicationRequest's about field
-- (distinct from about_reference which stores the FHIR reference string)
ALTER TABLE nphies_communication_requests
    ADD COLUMN IF NOT EXISTS about_identifier VARCHAR(255),
    ADD COLUMN IF NOT EXISTS about_identifier_system VARCHAR(500);

-- cr_identifier: The CommunicationRequest's own identifier (resource.identifier[0])
-- Used for basedOn in the solicited Communication response
ALTER TABLE nphies_communication_requests
    ADD COLUMN IF NOT EXISTS cr_identifier VARCHAR(255),
    ADD COLUMN IF NOT EXISTS cr_identifier_system VARCHAR(500);

COMMENT ON COLUMN nphies_communication_requests.about_identifier IS 'The identifier value from CommunicationRequest.about[0].identifier.value - used as about.identifier.value in solicited Communication';
COMMENT ON COLUMN nphies_communication_requests.about_identifier_system IS 'The identifier system from CommunicationRequest.about[0].identifier.system';
COMMENT ON COLUMN nphies_communication_requests.cr_identifier IS 'The CommunicationRequest own identifier value (resource.identifier[0].value) - used for basedOn in solicited Communication';
COMMENT ON COLUMN nphies_communication_requests.cr_identifier_system IS 'The CommunicationRequest own identifier system (resource.identifier[0].system) - used for basedOn.identifier.system';
