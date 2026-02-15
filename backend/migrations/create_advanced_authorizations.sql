-- Migration script for Advanced Authorizations table
-- NPHIES Advanced Authorization (APA) - Payer-initiated ClaimResponse
-- Profile: http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/advanced-authorization
-- Run this in pgAdmin Query Tool on your existing database

-- ============================================================================
-- ADVANCED AUTHORIZATIONS - Stores payer-initiated Advanced Authorization responses
-- ============================================================================
CREATE TABLE IF NOT EXISTS advanced_authorizations (
    id SERIAL PRIMARY KEY,
    
    -- FHIR ClaimResponse.identifier
    identifier_system VARCHAR(255),
    identifier_value VARCHAR(255),
    
    -- ClaimResponse core fields
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'draft', 'entered-in-error')),
    claim_type VARCHAR(50), -- institutional, oral, pharmacy, professional, vision
    claim_subtype VARCHAR(50), -- ip (inpatient), op (outpatient)
    use_field VARCHAR(50) DEFAULT 'preauthorization', -- preauthorization, claim, predetermination
    
    -- Advanced Auth specific extension
    auth_reason VARCHAR(100), -- referral, medication-dispense, etc.
    
    -- Outcome fields
    outcome VARCHAR(20), -- complete, queued, error, partial
    adjudication_outcome VARCHAR(50), -- approved, partial, denied, etc.
    disposition TEXT,
    
    -- References (stored as FHIR reference strings)
    patient_reference VARCHAR(255),
    insurer_reference VARCHAR(255),
    service_provider_reference VARCHAR(255),
    referring_provider_reference VARCHAR(255),
    referring_provider_display VARCHAR(255),
    
    -- PreAuth details
    pre_auth_ref VARCHAR(255),
    pre_auth_period_start TIMESTAMP,
    pre_auth_period_end TIMESTAMP,
    created_date DATE,
    
    -- Boolean flags
    is_newborn BOOLEAN DEFAULT false,
    
    -- Transfer fields
    transfer_auth_number VARCHAR(255),
    transfer_auth_period_start TIMESTAMP,
    transfer_auth_period_end TIMESTAMP,
    transfer_auth_provider VARCHAR(255),
    
    -- JSONB fields for complex data
    prescription_reference JSONB, -- prescription extension reference
    response_bundle JSONB NOT NULL, -- Full raw FHIR ClaimResponse
    diagnoses JSONB, -- Parsed diagnosis extensions array
    supporting_info JSONB, -- Parsed supporting info extensions array
    add_items JSONB, -- Parsed addItem with adjudication
    totals JSONB, -- Parsed total amounts
    insurance JSONB, -- Insurance info
    process_notes JSONB, -- Process notes array
    reissue_reason VARCHAR(100), -- Reissue reason extension
    
    -- Metadata
    poll_bundle JSONB, -- The poll request bundle used to retrieve this
    poll_response_bundle JSONB, -- The full poll response bundle
    received_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    schema_name VARCHAR(100),
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index for common queries
CREATE INDEX IF NOT EXISTS idx_advanced_auth_auth_reason ON advanced_authorizations(auth_reason);
CREATE INDEX IF NOT EXISTS idx_advanced_auth_outcome ON advanced_authorizations(outcome);
CREATE INDEX IF NOT EXISTS idx_advanced_auth_adjudication ON advanced_authorizations(adjudication_outcome);
CREATE INDEX IF NOT EXISTS idx_advanced_auth_claim_type ON advanced_authorizations(claim_type);
CREATE INDEX IF NOT EXISTS idx_advanced_auth_status ON advanced_authorizations(status);
CREATE INDEX IF NOT EXISTS idx_advanced_auth_pre_auth_ref ON advanced_authorizations(pre_auth_ref);
CREATE INDEX IF NOT EXISTS idx_advanced_auth_identifier ON advanced_authorizations(identifier_value);
CREATE INDEX IF NOT EXISTS idx_advanced_auth_received_at ON advanced_authorizations(received_at);
CREATE INDEX IF NOT EXISTS idx_advanced_auth_schema ON advanced_authorizations(schema_name);

-- Trigger for updated_at
CREATE TRIGGER update_advanced_authorizations_updated_at
    BEFORE UPDATE ON advanced_authorizations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
