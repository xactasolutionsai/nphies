-- Migration script for Claim Submissions tables
-- NPHIES-compliant Claim model for billing after services are delivered
-- Supports all 5 claim types: institutional, professional, pharmacy, dental, vision
-- Run this in pgAdmin Query Tool on your existing database

-- ============================================================================
-- CLAIM SUBMISSIONS - Main table for NPHIES Claims (use: "claim")
-- ============================================================================
CREATE TABLE IF NOT EXISTS claim_submissions (
    id SERIAL PRIMARY KEY,
    claim_number VARCHAR(50) UNIQUE NOT NULL,
    
    -- Claim Type (per NPHIES profiles - same as prior auth types)
    claim_type VARCHAR(20) NOT NULL CHECK (claim_type IN ('institutional', 'professional', 'pharmacy', 'dental', 'vision')),
    
    -- Claim SubType (per NPHIES spec)
    sub_type VARCHAR(10) DEFAULT 'op' CHECK (sub_type IN ('ip', 'op', 'emr')),
    
    -- Foreign Keys
    patient_id UUID REFERENCES patients(patient_id) ON DELETE SET NULL,
    provider_id UUID REFERENCES providers(provider_id) ON DELETE SET NULL,
    insurer_id UUID REFERENCES insurers(insurer_id) ON DELETE SET NULL,
    coverage_id INTEGER, -- Reference to patient_coverage
    practitioner_id UUID, -- Reference to practitioner
    
    -- Prior Authorization Reference (optional - for claims that had prior auth)
    prior_auth_id INTEGER REFERENCES prior_authorizations(id) ON DELETE SET NULL,
    pre_auth_ref VARCHAR(100), -- The preAuthRef from approved PA
    
    -- Status Tracking
    status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'pending', 'queued', 'approved', 'partial', 'denied', 'paid', 'cancelled', 'error')),
    outcome VARCHAR(20) CHECK (outcome IN ('complete', 'partial', 'queued', 'error')),
    adjudication_outcome VARCHAR(20) CHECK (adjudication_outcome IN ('approved', 'rejected', 'partial')),
    disposition TEXT,
    
    -- NPHIES Integration Fields
    nphies_claim_id VARCHAR(100), -- Claim ID returned by NPHIES
    nphies_request_id VARCHAR(100), -- Our request identifier
    nphies_response_id VARCHAR(100), -- Response identifier from NPHIES
    nphies_message_id VARCHAR(100),
    nphies_response_code VARCHAR(50),
    is_nphies_generated BOOLEAN DEFAULT FALSE,
    
    -- Encounter Information
    encounter_identifier VARCHAR(100),
    encounter_class VARCHAR(20) CHECK (encounter_class IN ('inpatient', 'outpatient', 'daycase', 'emergency', 'ambulatory', 'home', 'telemedicine')),
    encounter_start TIMESTAMP,
    encounter_end TIMESTAMP,
    service_type VARCHAR(50),
    
    -- Emergency Fields
    triage_category VARCHAR(10),
    triage_date TIMESTAMP,
    encounter_priority VARCHAR(10),
    
    -- Episode Reference
    episode_identifier VARCHAR(100),
    
    -- Eligibility Reference
    eligibility_ref VARCHAR(100),
    eligibility_offline_ref VARCHAR(100),
    eligibility_offline_date DATE,
    eligibility_response_id VARCHAR(100),
    eligibility_response_system VARCHAR(255),
    
    -- Clinical Information
    diagnosis_codes TEXT, -- Comma-separated ICD-10 codes (summary)
    primary_diagnosis VARCHAR(50),
    
    -- Care Team
    practice_code VARCHAR(20),
    
    -- Priority
    priority VARCHAR(20) DEFAULT 'normal' CHECK (priority IN ('stat', 'normal', 'deferred')),
    
    -- Financial
    total_amount DECIMAL(12,2),
    approved_amount DECIMAL(12,2),
    eligible_amount DECIMAL(12,2),
    benefit_amount DECIMAL(12,2),
    copay_amount DECIMAL(12,2),
    tax_amount DECIMAL(12,2),
    currency VARCHAR(3) DEFAULT 'SAR',
    
    -- Request/Response storage (FHIR bundles for audit)
    request_bundle JSONB,
    response_bundle JSONB,
    
    -- Timestamps
    service_date DATE, -- Actual date service was provided
    request_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    response_date TIMESTAMP,
    payment_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- CLAIM SUBMISSION ITEMS - Line items (services/procedures/medications)
-- ============================================================================
CREATE TABLE IF NOT EXISTS claim_submission_items (
    id SERIAL PRIMARY KEY,
    claim_id INTEGER NOT NULL REFERENCES claim_submissions(id) ON DELETE CASCADE,
    
    -- Item Sequence
    sequence INTEGER NOT NULL,
    
    -- Service/Product Information
    product_or_service_code VARCHAR(50) NOT NULL,
    product_or_service_system VARCHAR(255),
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
    factor DECIMAL(5,2) DEFAULT 1.0,
    tax DECIMAL(12,2) DEFAULT 0,
    patient_share DECIMAL(12,2) DEFAULT 0,
    payer_share DECIMAL(12,2),
    net_amount DECIMAL(12,2),
    currency VARCHAR(3) DEFAULT 'SAR',
    
    -- Service Date (actual date service was provided)
    serviced_date DATE,
    serviced_period_start DATE,
    serviced_period_end DATE,
    
    -- Body Site (for procedures)
    body_site_code VARCHAR(50),
    body_site_system VARCHAR(255),
    sub_site_code VARCHAR(50),
    
    -- Extensions
    is_package BOOLEAN DEFAULT FALSE,
    is_maternity BOOLEAN DEFAULT FALSE,
    patient_invoice VARCHAR(100),
    
    -- Adjudication (from response)
    adjudication_status VARCHAR(20) CHECK (adjudication_status IN ('approved', 'denied', 'partial', 'pending')),
    adjudication_amount DECIMAL(12,2),
    adjudication_eligible_amount DECIMAL(12,2),
    adjudication_copay_amount DECIMAL(12,2),
    adjudication_approved_quantity DECIMAL(10,2),
    adjudication_reason TEXT,
    
    -- Additional Info
    description TEXT,
    notes TEXT,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(claim_id, sequence)
);

-- ============================================================================
-- CLAIM SUBMISSION SUPPORTING INFO - Clinical justification & vital signs
-- ============================================================================
CREATE TABLE IF NOT EXISTS claim_submission_supporting_info (
    id SERIAL PRIMARY KEY,
    claim_id INTEGER NOT NULL REFERENCES claim_submissions(id) ON DELETE CASCADE,
    
    -- Sequence for ordering
    sequence INTEGER NOT NULL,
    
    -- Category (per NPHIES supportingInfo categories)
    category VARCHAR(50) NOT NULL,
    category_system VARCHAR(255),
    
    -- Code (specific type within category)
    code VARCHAR(50),
    code_system VARCHAR(255),
    code_display VARCHAR(255),
    code_text TEXT, -- For free text values
    
    -- Value (one of these based on type)
    value_string TEXT,
    value_quantity DECIMAL(12,2),
    value_quantity_unit VARCHAR(50),
    value_boolean BOOLEAN,
    value_date DATE,
    value_period_start DATE,
    value_period_end DATE,
    value_reference VARCHAR(255),
    
    -- Timing
    timing_date DATE,
    timing_period_start TIMESTAMP,
    timing_period_end TIMESTAMP,
    
    -- Reason
    reason_code VARCHAR(50),
    reason_system VARCHAR(255),
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(claim_id, sequence)
);

-- ============================================================================
-- CLAIM SUBMISSION DIAGNOSES - Multiple diagnoses per claim
-- ============================================================================
CREATE TABLE IF NOT EXISTS claim_submission_diagnoses (
    id SERIAL PRIMARY KEY,
    claim_id INTEGER NOT NULL REFERENCES claim_submissions(id) ON DELETE CASCADE,
    
    sequence INTEGER NOT NULL,
    diagnosis_code VARCHAR(50) NOT NULL,
    diagnosis_system VARCHAR(255) DEFAULT 'http://hl7.org/fhir/sid/icd-10-am',
    diagnosis_display VARCHAR(255),
    
    -- Type
    diagnosis_type VARCHAR(20) DEFAULT 'principal' CHECK (diagnosis_type IN ('principal', 'secondary', 'admitting', 'discharge')),
    
    -- On Admission (required for institutional claims)
    on_admission BOOLEAN,
    
    -- Condition Onset extension
    condition_onset VARCHAR(20) DEFAULT 'NR',
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(claim_id, sequence)
);

-- ============================================================================
-- CLAIM SUBMISSION RESPONSES - Store payer responses for history
-- ============================================================================
CREATE TABLE IF NOT EXISTS claim_submission_responses (
    id SERIAL PRIMARY KEY,
    claim_id INTEGER NOT NULL REFERENCES claim_submissions(id) ON DELETE CASCADE,
    
    -- Response Type
    response_type VARCHAR(20) NOT NULL CHECK (response_type IN ('initial', 'update', 'cancel', 'poll', 'final')),
    
    -- Response Details
    outcome VARCHAR(20) CHECK (outcome IN ('complete', 'partial', 'queued', 'error')),
    disposition TEXT,
    nphies_claim_id VARCHAR(100),
    
    -- Full FHIR Bundle
    bundle_json JSONB NOT NULL,
    
    -- Error Information
    has_errors BOOLEAN DEFAULT FALSE,
    errors JSONB,
    
    -- NPHIES Metadata
    is_nphies_generated BOOLEAN DEFAULT FALSE,
    nphies_response_id VARCHAR(100),
    
    -- Timestamps
    received_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- CLAIM SUBMISSION ATTACHMENTS - Binary files
-- ============================================================================
CREATE TABLE IF NOT EXISTS claim_submission_attachments (
    id SERIAL PRIMARY KEY,
    claim_id INTEGER NOT NULL REFERENCES claim_submissions(id) ON DELETE CASCADE,
    supporting_info_id INTEGER REFERENCES claim_submission_supporting_info(id) ON DELETE SET NULL,
    
    -- File Information
    file_name VARCHAR(255) NOT NULL,
    content_type VARCHAR(100) NOT NULL,
    file_size INTEGER,
    
    -- Content (base64 encoded)
    base64_content TEXT NOT NULL,
    
    -- Metadata
    title VARCHAR(255),
    description TEXT,
    category VARCHAR(50),
    
    -- FHIR Reference
    binary_id VARCHAR(100),
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- INDEXES for performance
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_claim_submissions_claim_number ON claim_submissions(claim_number);
CREATE INDEX IF NOT EXISTS idx_claim_submissions_patient_id ON claim_submissions(patient_id);
CREATE INDEX IF NOT EXISTS idx_claim_submissions_provider_id ON claim_submissions(provider_id);
CREATE INDEX IF NOT EXISTS idx_claim_submissions_insurer_id ON claim_submissions(insurer_id);
CREATE INDEX IF NOT EXISTS idx_claim_submissions_status ON claim_submissions(status);
CREATE INDEX IF NOT EXISTS idx_claim_submissions_claim_type ON claim_submissions(claim_type);
CREATE INDEX IF NOT EXISTS idx_claim_submissions_prior_auth_id ON claim_submissions(prior_auth_id);
CREATE INDEX IF NOT EXISTS idx_claim_submissions_pre_auth_ref ON claim_submissions(pre_auth_ref);
CREATE INDEX IF NOT EXISTS idx_claim_submissions_created_at ON claim_submissions(created_at);
CREATE INDEX IF NOT EXISTS idx_claim_submissions_service_date ON claim_submissions(service_date);

CREATE INDEX IF NOT EXISTS idx_claim_submission_items_claim_id ON claim_submission_items(claim_id);
CREATE INDEX IF NOT EXISTS idx_claim_submission_items_sequence ON claim_submission_items(claim_id, sequence);

CREATE INDEX IF NOT EXISTS idx_claim_submission_supporting_info_claim_id ON claim_submission_supporting_info(claim_id);

CREATE INDEX IF NOT EXISTS idx_claim_submission_diagnoses_claim_id ON claim_submission_diagnoses(claim_id);

CREATE INDEX IF NOT EXISTS idx_claim_submission_responses_claim_id ON claim_submission_responses(claim_id);
CREATE INDEX IF NOT EXISTS idx_claim_submission_responses_received_at ON claim_submission_responses(received_at);

CREATE INDEX IF NOT EXISTS idx_claim_submission_attachments_claim_id ON claim_submission_attachments(claim_id);

-- ============================================================================
-- TRIGGERS for updated_at
-- ============================================================================
DROP TRIGGER IF EXISTS update_claim_submissions_updated_at ON claim_submissions;
CREATE TRIGGER update_claim_submissions_updated_at 
    BEFORE UPDATE ON claim_submissions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- VERIFICATION
-- ============================================================================
SELECT 
    'Claim Submissions Migration completed successfully!' as status,
    (SELECT COUNT(*) FROM information_schema.tables 
     WHERE table_name IN (
        'claim_submissions', 
        'claim_submission_items', 
        'claim_submission_supporting_info',
        'claim_submission_diagnoses',
        'claim_submission_responses',
        'claim_submission_attachments'
     )) as tables_created;
