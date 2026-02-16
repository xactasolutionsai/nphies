-- Migration: Create system-level poll tables
-- These tables store the audit trail for system-wide NPHIES polling
-- poll_logs: Records each poll execution (request + response + stats)
-- poll_messages: Records each individual message extracted from a poll response

-- ============================================================================
-- POLL_LOGS - Records each poll execution
-- ============================================================================
CREATE TABLE IF NOT EXISTS poll_logs (
    id SERIAL PRIMARY KEY,
    poll_id UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
    
    -- Context
    schema_name VARCHAR(100) DEFAULT 'public',
    provider_nphies_id VARCHAR(100),
    trigger_type VARCHAR(50) NOT NULL DEFAULT 'manual' CHECK (trigger_type IN ('manual', 'scheduled')),
    
    -- Status
    status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'success', 'error', 'no_messages')),
    
    -- FHIR bundles (audit)
    poll_bundle JSONB,           -- outgoing poll request bundle
    response_bundle JSONB,       -- raw NPHIES response bundle
    response_code VARCHAR(50),   -- HTTP response code or NPHIES response code
    
    -- Statistics
    messages_received INTEGER DEFAULT 0,
    messages_processed INTEGER DEFAULT 0,
    messages_matched INTEGER DEFAULT 0,
    messages_unmatched INTEGER DEFAULT 0,
    
    -- Breakdown by type: { "ClaimResponse": { matched: 2, unmatched: 1 }, "CommunicationRequest": { matched: 1 } }
    processing_summary JSONB,
    
    -- Error tracking
    errors JSONB,                -- Array of error objects
    
    -- Timing
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    duration_ms INTEGER,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- POLL_MESSAGES - Records each individual message extracted from a poll response
-- ============================================================================
CREATE TABLE IF NOT EXISTS poll_messages (
    id SERIAL PRIMARY KEY,
    poll_log_id INTEGER NOT NULL REFERENCES poll_logs(id) ON DELETE CASCADE,
    
    -- Message identification
    message_header_id VARCHAR(255),          -- MessageHeader.id from the response message
    response_identifier VARCHAR(255),        -- MessageHeader.response.identifier (for solicited messages)
    event_code VARCHAR(100),                 -- MessageHeader.event.coding.code (e.g., 'priorauthorization-response')
    
    -- Resource info
    resource_type VARCHAR(100),              -- 'ClaimResponse', 'CommunicationRequest', 'Communication', etc.
    resource_data JSONB,                     -- The individual message bundle
    
    -- Message classification
    message_type VARCHAR(50) NOT NULL DEFAULT 'unknown' CHECK (message_type IN ('solicited', 'unsolicited', 'unknown')),
    
    -- Correlation results
    matched BOOLEAN DEFAULT FALSE,
    matched_table VARCHAR(100),              -- 'prior_authorizations', 'claim_submissions', 'advanced_authorizations', etc.
    matched_record_id INTEGER,               -- The ID of the matched record
    match_strategy VARCHAR(100),             -- How the match was made (e.g., 'message_header_id', 'claim_response_identifier', 'new_record')
    
    -- Processing status
    processing_status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (processing_status IN ('pending', 'processed', 'error', 'unmatched', 'new_record')),
    processing_error TEXT,                   -- Error message if processing failed
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for poll_logs
CREATE INDEX IF NOT EXISTS idx_poll_logs_status ON poll_logs(status);
CREATE INDEX IF NOT EXISTS idx_poll_logs_trigger_type ON poll_logs(trigger_type);
CREATE INDEX IF NOT EXISTS idx_poll_logs_created_at ON poll_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_poll_logs_schema_name ON poll_logs(schema_name);

-- Indexes for poll_messages
CREATE INDEX IF NOT EXISTS idx_poll_messages_poll_log_id ON poll_messages(poll_log_id);
CREATE INDEX IF NOT EXISTS idx_poll_messages_response_identifier ON poll_messages(response_identifier);
CREATE INDEX IF NOT EXISTS idx_poll_messages_resource_type ON poll_messages(resource_type);
CREATE INDEX IF NOT EXISTS idx_poll_messages_matched ON poll_messages(matched);
CREATE INDEX IF NOT EXISTS idx_poll_messages_matched_table ON poll_messages(matched_table, matched_record_id);
CREATE INDEX IF NOT EXISTS idx_poll_messages_processing_status ON poll_messages(processing_status);
CREATE INDEX IF NOT EXISTS idx_poll_messages_message_type ON poll_messages(message_type);
