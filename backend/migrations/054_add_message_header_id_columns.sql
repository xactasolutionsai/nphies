-- Migration: Add outbound_message_header_id columns for poll message correlation
-- When we submit a request to NPHIES, the outgoing bundle contains a MessageHeader with a unique ID.
-- NPHIES responses include MessageHeader.response.identifier referencing this ID.
-- Storing it enables fast correlation during system-level polling.

-- Prior Authorizations
ALTER TABLE prior_authorizations
    ADD COLUMN IF NOT EXISTS outbound_message_header_id VARCHAR(255);

CREATE INDEX IF NOT EXISTS idx_prior_auth_outbound_msg_hdr_id
    ON prior_authorizations(outbound_message_header_id);

CREATE INDEX IF NOT EXISTS idx_prior_auth_nphies_request_id
    ON prior_authorizations(nphies_request_id);

-- Claim Submissions
ALTER TABLE claim_submissions
    ADD COLUMN IF NOT EXISTS outbound_message_header_id VARCHAR(255);

CREATE INDEX IF NOT EXISTS idx_claim_sub_outbound_msg_hdr_id
    ON claim_submissions(outbound_message_header_id);

CREATE INDEX IF NOT EXISTS idx_claim_sub_nphies_request_id
    ON claim_submissions(nphies_request_id);

COMMENT ON COLUMN prior_authorizations.outbound_message_header_id IS 'The MessageHeader.id from the outbound FHIR bundle sent to NPHIES. Used for correlating poll responses via MessageHeader.response.identifier.';
COMMENT ON COLUMN claim_submissions.outbound_message_header_id IS 'The MessageHeader.id from the outbound FHIR bundle sent to NPHIES. Used for correlating poll responses via MessageHeader.response.identifier.';
