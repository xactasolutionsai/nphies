-- Migration: Add advanced_authorization_id to communication tables
-- This allows linking communications to Advanced Authorizations (payer-initiated APAs)

ALTER TABLE nphies_communication_requests
ADD COLUMN IF NOT EXISTS advanced_authorization_id INTEGER;

ALTER TABLE nphies_communications
ADD COLUMN IF NOT EXISTS advanced_authorization_id INTEGER;

CREATE INDEX IF NOT EXISTS idx_comm_requests_adv_auth_id ON nphies_communication_requests(advanced_authorization_id);
CREATE INDEX IF NOT EXISTS idx_comms_adv_auth_id ON nphies_communications(advanced_authorization_id);
