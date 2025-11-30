-- Migration script for Prior Authorization tables
-- NPHIES-compliant Prior Authorization model supporting all 5 authorization types
-- Run this in pgAdmin Query Tool on your existing database

-- Ensure the update_updated_at_column function exists
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- ============================================================================
-- PRIOR AUTHORIZATIONS - Main table
-- ============================================================================
CREATE TABLE IF NOT EXISTS prior_authorizations (
    id SERIAL PRIMARY KEY,
    request_number VARCHAR(50) UNIQUE NOT NULL,
    
    -- Authorization Type (per NPHIES profiles)
    auth_type VARCHAR(20) NOT NULL CHECK (auth_type IN ('institutional', 'professional', 'pharmacy', 'dental', 'vision')),
    
    -- Foreign Keys (using UUID to match existing tables)
    patient_id UUID REFERENCES patients(patient_id) ON DELETE SET NULL,
    provider_id UUID REFERENCES providers(provider_id) ON DELETE SET NULL,
    insurer_id UUID REFERENCES insurers(insurer_id) ON DELETE SET NULL,
    coverage_id INTEGER, -- Reference to coverage if stored separately
    practitioner_id UUID, -- Reference to practitioner if stored separately
    
    -- Status Tracking
    status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'pending', 'queued', 'approved', 'partial', 'denied', 'cancelled', 'error')),
    outcome VARCHAR(20) CHECK (outcome IN ('complete', 'partial', 'queued', 'error')),
    disposition TEXT,
    
    -- NPHIES Integration Fields
    pre_auth_ref VARCHAR(100), -- Authorization reference returned by payer
    nphies_request_id VARCHAR(100), -- Our request identifier sent to NPHIES
    nphies_response_id VARCHAR(100), -- Response identifier from NPHIES
    is_nphies_generated BOOLEAN DEFAULT FALSE, -- True if response was pended by NPHIES
    
    -- Encounter Information
    encounter_class VARCHAR(20) CHECK (encounter_class IN ('inpatient', 'outpatient', 'daycase', 'emergency', 'ambulatory', 'home', 'telemedicine')),
    encounter_start TIMESTAMP,
    encounter_end TIMESTAMP,
    
    -- Workflow Fields
    is_update BOOLEAN DEFAULT FALSE, -- True if this is an update to existing authorization
    related_auth_id INTEGER REFERENCES prior_authorizations(id) ON DELETE SET NULL, -- Previous authorization being updated
    is_transfer BOOLEAN DEFAULT FALSE, -- True if this is a transfer request
    transfer_provider_id UUID, -- Target provider for transfer
    transfer_auth_number VARCHAR(100), -- Transfer authorization number from payer
    transfer_period_start DATE,
    transfer_period_end DATE,
    is_cancelled BOOLEAN DEFAULT FALSE,
    cancellation_reason TEXT,
    
    -- Eligibility Reference (optional)
    eligibility_ref VARCHAR(100),
    eligibility_offline_date DATE,
    
    -- Clinical Information
    diagnosis_codes TEXT, -- Comma-separated ICD-10 codes
    primary_diagnosis VARCHAR(50),
    
    -- Priority
    priority VARCHAR(20) DEFAULT 'normal' CHECK (priority IN ('stat', 'normal', 'deferred')),
    
    -- Financial
    total_amount DECIMAL(12,2),
    approved_amount DECIMAL(12,2),
    currency VARCHAR(3) DEFAULT 'SAR',
    
    -- Request/Response storage (FHIR bundles for audit)
    request_bundle JSONB,
    response_bundle JSONB,
    
    -- Timestamps
    request_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    response_date TIMESTAMP,
    pre_auth_period_start DATE,
    pre_auth_period_end DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- PRIOR AUTHORIZATION ITEMS - Line items (services/procedures/medications)
-- ============================================================================
CREATE TABLE IF NOT EXISTS prior_authorization_items (
    id SERIAL PRIMARY KEY,
    prior_auth_id INTEGER NOT NULL REFERENCES prior_authorizations(id) ON DELETE CASCADE,
    
    -- Item Sequence (MUST be preserved across updates per NPHIES spec)
    sequence INTEGER NOT NULL,
    
    -- Service/Product Information
    product_or_service_code VARCHAR(50) NOT NULL,
    product_or_service_system VARCHAR(255), -- Code system (CPT, SNOMED, NPHIES, etc.)
    product_or_service_display VARCHAR(255),
    
    -- For Dental: Tooth information
    tooth_number VARCHAR(10),
    tooth_surface VARCHAR(50),
    
    -- For Vision: Eye information
    eye VARCHAR(10) CHECK (eye IN ('left', 'right', 'both')),
    
    -- For Pharmacy: Medication details
    medication_code VARCHAR(50),
    medication_system VARCHAR(255),
    days_supply INTEGER,
    
    -- Quantity and Pricing
    quantity DECIMAL(10,2) DEFAULT 1,
    unit_price DECIMAL(12,2),
    net_amount DECIMAL(12,2),
    currency VARCHAR(3) DEFAULT 'SAR',
    
    -- Service Date (required for completed items in updates)
    serviced_date DATE,
    serviced_period_start DATE,
    serviced_period_end DATE,
    
    -- Body Site (for procedures)
    body_site_code VARCHAR(50),
    body_site_system VARCHAR(255),
    sub_site_code VARCHAR(50),
    
    -- Adjudication (from response)
    adjudication_status VARCHAR(20) CHECK (adjudication_status IN ('approved', 'denied', 'partial', 'pending')),
    adjudication_amount DECIMAL(12,2),
    adjudication_reason TEXT,
    
    -- Additional Info
    description TEXT,
    notes TEXT,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(prior_auth_id, sequence)
);

-- ============================================================================
-- PRIOR AUTHORIZATION SUPPORTING INFO - Clinical justification
-- ============================================================================
CREATE TABLE IF NOT EXISTS prior_authorization_supporting_info (
    id SERIAL PRIMARY KEY,
    prior_auth_id INTEGER NOT NULL REFERENCES prior_authorizations(id) ON DELETE CASCADE,
    
    -- Sequence for ordering
    sequence INTEGER NOT NULL,
    
    -- Category (per NPHIES supportingInfo categories)
    category VARCHAR(50) NOT NULL, -- days-supply, attachment, info, onset, related-claim, etc.
    category_system VARCHAR(255),
    
    -- Code (specific type within category)
    code VARCHAR(50),
    code_system VARCHAR(255),
    code_display VARCHAR(255),
    
    -- Value (one of these based on type)
    value_string TEXT,
    value_quantity DECIMAL(12,2),
    value_quantity_unit VARCHAR(50),
    value_boolean BOOLEAN,
    value_date DATE,
    value_period_start DATE,
    value_period_end DATE,
    value_reference VARCHAR(255), -- Reference to another resource (e.g., Binary)
    
    -- Timing
    timing_date DATE,
    timing_period_start DATE,
    timing_period_end DATE,
    
    -- Reason
    reason_code VARCHAR(50),
    reason_system VARCHAR(255),
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(prior_auth_id, sequence)
);

-- ============================================================================
-- PRIOR AUTHORIZATION ATTACHMENTS - Binary files
-- ============================================================================
CREATE TABLE IF NOT EXISTS prior_authorization_attachments (
    id SERIAL PRIMARY KEY,
    prior_auth_id INTEGER NOT NULL REFERENCES prior_authorizations(id) ON DELETE CASCADE,
    supporting_info_id INTEGER REFERENCES prior_authorization_supporting_info(id) ON DELETE SET NULL,
    
    -- File Information
    file_name VARCHAR(255) NOT NULL,
    content_type VARCHAR(100) NOT NULL, -- MIME type (application/pdf, image/jpeg, etc.)
    file_size INTEGER,
    
    -- Content (base64 encoded for FHIR Binary resource)
    base64_content TEXT NOT NULL,
    
    -- Metadata
    title VARCHAR(255),
    description TEXT,
    category VARCHAR(50), -- lab-report, radiology, clinical-notes, etc.
    
    -- FHIR Reference
    binary_id VARCHAR(100), -- Generated ID for FHIR Binary resource
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- PRIOR AUTHORIZATION RESPONSES - Store payer responses for history
-- ============================================================================
CREATE TABLE IF NOT EXISTS prior_authorization_responses (
    id SERIAL PRIMARY KEY,
    prior_auth_id INTEGER NOT NULL REFERENCES prior_authorizations(id) ON DELETE CASCADE,
    
    -- Response Type
    response_type VARCHAR(20) NOT NULL CHECK (response_type IN ('initial', 'update', 'cancel', 'poll', 'final')),
    
    -- Response Details
    outcome VARCHAR(20) CHECK (outcome IN ('complete', 'partial', 'queued', 'error')),
    disposition TEXT,
    pre_auth_ref VARCHAR(100),
    
    -- Full FHIR Bundle (for audit and debugging)
    bundle_json JSONB NOT NULL,
    
    -- Error Information
    has_errors BOOLEAN DEFAULT FALSE,
    errors JSONB, -- Array of OperationOutcome issues
    
    -- NPHIES Metadata
    is_nphies_generated BOOLEAN DEFAULT FALSE,
    nphies_response_id VARCHAR(100),
    
    -- Timestamps
    received_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- PRIOR AUTHORIZATION DIAGNOSES - Multiple diagnoses per request
-- ============================================================================
CREATE TABLE IF NOT EXISTS prior_authorization_diagnoses (
    id SERIAL PRIMARY KEY,
    prior_auth_id INTEGER NOT NULL REFERENCES prior_authorizations(id) ON DELETE CASCADE,
    
    sequence INTEGER NOT NULL,
    diagnosis_code VARCHAR(50) NOT NULL,
    diagnosis_system VARCHAR(255) DEFAULT 'http://hl7.org/fhir/sid/icd-10',
    diagnosis_display VARCHAR(255),
    
    -- Type
    diagnosis_type VARCHAR(20) DEFAULT 'principal' CHECK (diagnosis_type IN ('principal', 'secondary', 'admitting', 'discharge')),
    
    -- On Admission
    on_admission BOOLEAN,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(prior_auth_id, sequence)
);

-- ============================================================================
-- INDEXES for performance
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_prior_auth_request_number ON prior_authorizations(request_number);
CREATE INDEX IF NOT EXISTS idx_prior_auth_patient_id ON prior_authorizations(patient_id);
CREATE INDEX IF NOT EXISTS idx_prior_auth_provider_id ON prior_authorizations(provider_id);
CREATE INDEX IF NOT EXISTS idx_prior_auth_insurer_id ON prior_authorizations(insurer_id);
CREATE INDEX IF NOT EXISTS idx_prior_auth_status ON prior_authorizations(status);
CREATE INDEX IF NOT EXISTS idx_prior_auth_auth_type ON prior_authorizations(auth_type);
CREATE INDEX IF NOT EXISTS idx_prior_auth_pre_auth_ref ON prior_authorizations(pre_auth_ref);
CREATE INDEX IF NOT EXISTS idx_prior_auth_created_at ON prior_authorizations(created_at);
CREATE INDEX IF NOT EXISTS idx_prior_auth_request_date ON prior_authorizations(request_date);

CREATE INDEX IF NOT EXISTS idx_prior_auth_items_prior_auth_id ON prior_authorization_items(prior_auth_id);
CREATE INDEX IF NOT EXISTS idx_prior_auth_items_sequence ON prior_authorization_items(prior_auth_id, sequence);

CREATE INDEX IF NOT EXISTS idx_prior_auth_supporting_info_prior_auth_id ON prior_authorization_supporting_info(prior_auth_id);

CREATE INDEX IF NOT EXISTS idx_prior_auth_attachments_prior_auth_id ON prior_authorization_attachments(prior_auth_id);

CREATE INDEX IF NOT EXISTS idx_prior_auth_responses_prior_auth_id ON prior_authorization_responses(prior_auth_id);
CREATE INDEX IF NOT EXISTS idx_prior_auth_responses_received_at ON prior_authorization_responses(received_at);

CREATE INDEX IF NOT EXISTS idx_prior_auth_diagnoses_prior_auth_id ON prior_authorization_diagnoses(prior_auth_id);

-- ============================================================================
-- TRIGGERS for updated_at
-- ============================================================================
DROP TRIGGER IF EXISTS update_prior_authorizations_updated_at ON prior_authorizations;
CREATE TRIGGER update_prior_authorizations_updated_at 
    BEFORE UPDATE ON prior_authorizations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- VERIFICATION
-- ============================================================================
SELECT 
    'Prior Authorization Migration completed successfully!' as status,
    (SELECT COUNT(*) FROM information_schema.tables 
     WHERE table_name IN (
        'prior_authorizations', 
        'prior_authorization_items', 
        'prior_authorization_supporting_info',
        'prior_authorization_attachments',
        'prior_authorization_responses',
        'prior_authorization_diagnoses'
     )) as tables_created;

