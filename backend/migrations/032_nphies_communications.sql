-- Migration: NPHIES Communications
-- Supports both Test Case #1 (Unsolicited) and Test Case #2 (Solicited) Communication flows
-- Run this in pgAdmin Query Tool on your existing database

-- ============================================================================
-- COMMUNICATION REQUESTS - Received from HIC asking for additional information
-- Used in Test Case #2 (Solicited Communication)
-- ============================================================================
CREATE TABLE IF NOT EXISTS nphies_communication_requests (
    id SERIAL PRIMARY KEY,
    
    -- NPHIES Identifiers
    request_id VARCHAR(100) UNIQUE NOT NULL,
    nphies_request_id VARCHAR(100),
    
    -- References to existing entities
    prior_auth_id INTEGER REFERENCES prior_authorizations(id) ON DELETE SET NULL,
    claim_id INTEGER, -- Reference to claim_submissions if applicable
    
    -- CommunicationRequest Status (per NPHIES BV-00335: must be 'active')
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('draft', 'active', 'on-hold', 'revoked', 'completed', 'entered-in-error', 'unknown')),
    
    -- Category and Priority
    category VARCHAR(50), -- e.g., 'alert', 'notification', 'reminder', 'instruction'
    priority VARCHAR(20) CHECK (priority IN ('routine', 'urgent', 'asap', 'stat')),
    
    -- About Reference (BV-00233: must reference Claim or ClaimResponse)
    about_reference VARCHAR(255),
    about_type VARCHAR(50) CHECK (about_type IN ('Claim', 'ClaimResponse')),
    
    -- Payload Content (CMRQ001: only ONE of string, attachment, or reference)
    payload_content_type VARCHAR(20) CHECK (payload_content_type IN ('string', 'attachment', 'reference')),
    payload_content_string TEXT,
    payload_attachment_content_type VARCHAR(100),
    payload_attachment_data TEXT, -- Base64 encoded
    payload_attachment_url VARCHAR(500),
    payload_attachment_title VARCHAR(255),
    payload_reference VARCHAR(255),
    
    -- Sender/Recipient
    sender_type VARCHAR(50),
    sender_identifier VARCHAR(100),
    recipient_type VARCHAR(50),
    recipient_identifier VARCHAR(100),
    
    -- Timestamps
    authored_on TIMESTAMP,
    occurrence_datetime TIMESTAMP,
    received_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Response tracking
    responded_at TIMESTAMP,
    response_communication_id INTEGER, -- Will reference nphies_communications.id
    
    -- Store full FHIR bundle for audit
    request_bundle JSONB,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- COMMUNICATIONS - Sent by HCP (both unsolicited and solicited)
-- Test Case #1: Unsolicited - HCP proactively sends info
-- Test Case #2: Solicited - HCP responds to CommunicationRequest
-- ============================================================================
CREATE TABLE IF NOT EXISTS nphies_communications (
    id SERIAL PRIMARY KEY,
    
    -- NPHIES Identifiers
    communication_id VARCHAR(100) UNIQUE NOT NULL,
    nphies_communication_id VARCHAR(100),
    
    -- References to existing entities
    prior_auth_id INTEGER REFERENCES prior_authorizations(id) ON DELETE SET NULL,
    claim_id INTEGER, -- Reference to claim_submissions if applicable
    patient_id UUID REFERENCES patients(patient_id) ON DELETE SET NULL,
    
    -- Communication Type
    communication_type VARCHAR(20) NOT NULL CHECK (communication_type IN ('unsolicited', 'solicited')),
    
    -- For solicited: reference to the CommunicationRequest we're responding to
    based_on_request_id INTEGER REFERENCES nphies_communication_requests(id) ON DELETE SET NULL,
    
    -- Communication Status
    -- 'in-progress' while drafting, 'completed' when sent
    status VARCHAR(20) DEFAULT 'in-progress' CHECK (status IN ('preparation', 'in-progress', 'not-done', 'on-hold', 'stopped', 'completed', 'entered-in-error', 'unknown')),
    
    -- Category and Priority
    category VARCHAR(50) DEFAULT 'alert',
    priority VARCHAR(20) DEFAULT 'routine' CHECK (priority IN ('routine', 'urgent', 'asap', 'stat')),
    
    -- About Reference (the Claim/ClaimResponse this relates to)
    about_reference VARCHAR(255),
    about_type VARCHAR(50) CHECK (about_type IN ('Claim', 'ClaimResponse')),
    
    -- Sender/Recipient
    sender_type VARCHAR(50) DEFAULT 'Organization',
    sender_identifier VARCHAR(100),
    recipient_type VARCHAR(50) DEFAULT 'Organization',
    recipient_identifier VARCHAR(100),
    
    -- Timestamps
    sent_at TIMESTAMP,
    
    -- Acknowledgment tracking (received via polling)
    acknowledgment_received BOOLEAN DEFAULT FALSE,
    acknowledgment_at TIMESTAMP,
    acknowledgment_status VARCHAR(50),
    acknowledgment_bundle JSONB,
    
    -- Store full FHIR bundles for audit
    request_bundle JSONB,
    response_bundle JSONB, -- Immediate response from NPHIES (not the ack)
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- COMMUNICATION PAYLOADS - Multiple payloads per Communication
-- Each payload has ClaimItemSequence extension to reference specific items
-- ============================================================================
CREATE TABLE IF NOT EXISTS nphies_communication_payloads (
    id SERIAL PRIMARY KEY,
    communication_id INTEGER NOT NULL REFERENCES nphies_communications(id) ON DELETE CASCADE,
    
    -- Sequence number (for ordering)
    sequence INTEGER NOT NULL,
    
    -- Content Type (CMRQ001: only ONE of string, attachment, or reference per payload)
    content_type VARCHAR(20) NOT NULL CHECK (content_type IN ('string', 'attachment', 'reference')),
    
    -- String content (free text) - Test Case #1
    content_string TEXT,
    
    -- Attachment content - Test Case #2
    attachment_content_type VARCHAR(100), -- e.g., 'application/pdf', 'image/jpeg'
    attachment_data TEXT, -- Base64 encoded
    attachment_url VARCHAR(500),
    attachment_title VARCHAR(255),
    attachment_size INTEGER, -- Size in bytes
    attachment_hash VARCHAR(64), -- SHA-256 hash
    
    -- Reference content
    reference_value VARCHAR(255),
    reference_type VARCHAR(50),
    
    -- ClaimItemSequence extension - links payload to specific authorization items
    -- Array of item sequence numbers this payload relates to
    claim_item_sequences INTEGER[],
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(communication_id, sequence)
);

-- ============================================================================
-- INDEXES for performance
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_comm_req_prior_auth ON nphies_communication_requests(prior_auth_id);
CREATE INDEX IF NOT EXISTS idx_comm_req_status ON nphies_communication_requests(status);
CREATE INDEX IF NOT EXISTS idx_comm_req_received ON nphies_communication_requests(received_at);

CREATE INDEX IF NOT EXISTS idx_comm_prior_auth ON nphies_communications(prior_auth_id);
CREATE INDEX IF NOT EXISTS idx_comm_type ON nphies_communications(communication_type);
CREATE INDEX IF NOT EXISTS idx_comm_status ON nphies_communications(status);
CREATE INDEX IF NOT EXISTS idx_comm_based_on ON nphies_communications(based_on_request_id);
CREATE INDEX IF NOT EXISTS idx_comm_ack_received ON nphies_communications(acknowledgment_received);

CREATE INDEX IF NOT EXISTS idx_comm_payload_comm ON nphies_communication_payloads(communication_id);

-- ============================================================================
-- UPDATE TRIGGERS
-- ============================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_nphies_communication_requests_updated_at ON nphies_communication_requests;
CREATE TRIGGER update_nphies_communication_requests_updated_at
    BEFORE UPDATE ON nphies_communication_requests
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_nphies_communications_updated_at ON nphies_communications;
CREATE TRIGGER update_nphies_communications_updated_at
    BEFORE UPDATE ON nphies_communications
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- Update foreign key for response_communication_id after nphies_communications exists
-- ============================================================================
ALTER TABLE nphies_communication_requests 
    DROP CONSTRAINT IF EXISTS fk_response_communication;
    
ALTER TABLE nphies_communication_requests
    ADD CONSTRAINT fk_response_communication 
    FOREIGN KEY (response_communication_id) 
    REFERENCES nphies_communications(id) 
    ON DELETE SET NULL;

-- ============================================================================
-- COMMENTS for documentation
-- ============================================================================
COMMENT ON TABLE nphies_communication_requests IS 'CommunicationRequests received from HIC (insurers) requesting additional information for prior authorizations or claims';
COMMENT ON TABLE nphies_communications IS 'Communications sent by HCP to HIC - both unsolicited (proactive) and solicited (in response to CommunicationRequest)';
COMMENT ON TABLE nphies_communication_payloads IS 'Payload content for Communications - can include free text, attachments, or references with ClaimItemSequence extension';

COMMENT ON COLUMN nphies_communications.communication_type IS 'unsolicited = HCP proactively sends info (Test Case #1), solicited = HCP responds to CommunicationRequest (Test Case #2)';
COMMENT ON COLUMN nphies_communications.based_on_request_id IS 'For solicited communications, references the CommunicationRequest being responded to';
COMMENT ON COLUMN nphies_communications.acknowledgment_received IS 'True when acknowledgment is received via polling';
COMMENT ON COLUMN nphies_communication_payloads.claim_item_sequences IS 'Array of item sequence numbers from the original Claim that this payload relates to';

