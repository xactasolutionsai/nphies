-- Payment Reconciliation Module Migration
-- nphies FHIR R4 Compliant Payment Reconciliation Storage
-- This module handles payment notifications from insurers (HICs) to providers

-- =====================================================
-- Table 1: payment_reconciliations (main table)
-- Stores the PaymentReconciliation resource data
-- =====================================================
CREATE TABLE IF NOT EXISTS payment_reconciliations (
    id SERIAL PRIMARY KEY,
    
    -- FHIR Resource identifiers
    fhir_id VARCHAR(255) NOT NULL,                          -- PaymentReconciliation.id
    identifier_system VARCHAR(500),                          -- PaymentReconciliation.identifier.system
    identifier_value VARCHAR(255),                           -- PaymentReconciliation.identifier.value
    
    -- Status and outcome
    status VARCHAR(50) NOT NULL DEFAULT 'active',            -- active | cancelled | draft | entered-in-error
    outcome VARCHAR(50),                                     -- queued | complete | error | partial
    disposition TEXT,                                        -- Human readable disposition message
    
    -- Period
    period_start DATE,                                       -- PaymentReconciliation.period.start
    period_end DATE,                                         -- PaymentReconciliation.period.end
    
    -- Created and payment dates
    created_date TIMESTAMP NOT NULL,                         -- PaymentReconciliation.created
    payment_date DATE NOT NULL,                              -- PaymentReconciliation.paymentDate
    
    -- Payment amount (total)
    payment_amount DECIMAL(15,2) NOT NULL,                   -- PaymentReconciliation.paymentAmount.value
    payment_currency VARCHAR(3) DEFAULT 'SAR',               -- PaymentReconciliation.paymentAmount.currency
    
    -- Payment identifier (e.g., EFT reference)
    payment_identifier_system VARCHAR(500),                  -- PaymentReconciliation.paymentIdentifier.system
    payment_identifier_value VARCHAR(255),                   -- PaymentReconciliation.paymentIdentifier.value
    payment_method_code VARCHAR(50),                         -- Payment method code (eft, check, etc.)
    
    -- References to organizations
    payment_issuer_reference VARCHAR(500),                   -- PaymentReconciliation.paymentIssuer (Insurer)
    payment_issuer_id UUID,                                  -- FK to insurers table (if matched)
    requestor_reference VARCHAR(500),                        -- PaymentReconciliation.requestor (Provider)
    requestor_id UUID,                                       -- FK to providers table (if matched)
    
    -- Raw FHIR data for audit and forward compatibility
    request_bundle JSONB,                                    -- Original incoming FHIR Bundle
    response_bundle JSONB,                                   -- Acknowledgement Bundle sent back
    
    -- nphies tracking
    nphies_message_id VARCHAR(255),                          -- MessageHeader.id from bundle
    nphies_request_id VARCHAR(255),                          -- Original request identifier
    
    -- Processing metadata
    processing_status VARCHAR(50) DEFAULT 'received',        -- received | processed | error | duplicate
    processing_errors JSONB,                                 -- Any processing errors
    is_duplicate BOOLEAN DEFAULT FALSE,                      -- Flag for duplicate detection
    
    -- Timestamps
    received_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Foreign key constraints
    CONSTRAINT fk_payment_issuer FOREIGN KEY (payment_issuer_id) 
        REFERENCES insurers(insurer_id) ON DELETE SET NULL,
    CONSTRAINT fk_requestor FOREIGN KEY (requestor_id) 
        REFERENCES providers(provider_id) ON DELETE SET NULL,
    
    -- Unique constraint on FHIR identifier to prevent duplicates
    CONSTRAINT uq_payment_reconciliation_fhir_id UNIQUE (fhir_id, identifier_system, identifier_value)
);

-- Index for common queries
CREATE INDEX IF NOT EXISTS idx_payment_reconciliations_status ON payment_reconciliations(status);
CREATE INDEX IF NOT EXISTS idx_payment_reconciliations_payment_date ON payment_reconciliations(payment_date);
CREATE INDEX IF NOT EXISTS idx_payment_reconciliations_issuer ON payment_reconciliations(payment_issuer_id);
CREATE INDEX IF NOT EXISTS idx_payment_reconciliations_requestor ON payment_reconciliations(requestor_id);
CREATE INDEX IF NOT EXISTS idx_payment_reconciliations_fhir_id ON payment_reconciliations(fhir_id);
CREATE INDEX IF NOT EXISTS idx_payment_reconciliations_processing ON payment_reconciliations(processing_status);

-- =====================================================
-- Table 2: payment_reconciliation_details (detail items)
-- Stores individual payment details linked to claims
-- =====================================================
CREATE TABLE IF NOT EXISTS payment_reconciliation_details (
    id SERIAL PRIMARY KEY,
    
    -- Parent reconciliation
    reconciliation_id INTEGER NOT NULL,
    
    -- Detail sequence (for ordering)
    sequence INTEGER NOT NULL DEFAULT 1,
    
    -- Detail type
    type_system VARCHAR(500),                                -- detail.type.coding.system
    type_code VARCHAR(50),                                   -- detail.type.coding.code (payment, advance, etc.)
    type_display VARCHAR(255),                               -- detail.type.coding.display
    
    -- Claim reference (request)
    claim_reference VARCHAR(500),                            -- detail.request.reference
    claim_identifier_system VARCHAR(500),                    -- detail.request.identifier.system
    claim_identifier_value VARCHAR(255),                     -- detail.request.identifier.value
    claim_submission_id INTEGER,                             -- FK to claim_submissions if matched
    
    -- ClaimResponse reference (response)
    claim_response_reference VARCHAR(500),                   -- detail.response.reference
    claim_response_identifier_system VARCHAR(500),           -- detail.response.identifier.system
    claim_response_identifier_value VARCHAR(255),            -- detail.response.identifier.value
    
    -- Submitter (provider who submitted the claim)
    submitter_reference VARCHAR(500),                        -- detail.submitter.reference
    submitter_id UUID,                                       -- FK to providers if matched
    
    -- Payee (provider receiving payment)
    payee_reference VARCHAR(500),                            -- detail.payee.reference
    payee_id UUID,                                           -- FK to providers if matched
    
    -- Payment amount for this detail
    amount DECIMAL(15,2) NOT NULL,                           -- detail.amount.value
    currency VARCHAR(3) DEFAULT 'SAR',                       -- detail.amount.currency
    
    -- Detail date
    detail_date DATE,                                        -- detail.date
    
    -- Predecessor reference (for adjustments)
    predecessor_reference VARCHAR(500),                      -- detail.predecessor.reference
    
    -- Responsible party
    responsible_reference VARCHAR(500),                      -- detail.responsible.reference
    
    -- Raw extension data (for any extensions not explicitly parsed)
    extensions JSONB,                                        -- All extensions on this detail
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Foreign key constraints
    CONSTRAINT fk_detail_reconciliation FOREIGN KEY (reconciliation_id) 
        REFERENCES payment_reconciliations(id) ON DELETE CASCADE,
    CONSTRAINT fk_detail_claim FOREIGN KEY (claim_submission_id) 
        REFERENCES claim_submissions(id) ON DELETE SET NULL,
    CONSTRAINT fk_detail_submitter FOREIGN KEY (submitter_id) 
        REFERENCES providers(provider_id) ON DELETE SET NULL,
    CONSTRAINT fk_detail_payee FOREIGN KEY (payee_id) 
        REFERENCES providers(provider_id) ON DELETE SET NULL
);

-- Indexes for detail queries
CREATE INDEX IF NOT EXISTS idx_pr_details_reconciliation ON payment_reconciliation_details(reconciliation_id);
CREATE INDEX IF NOT EXISTS idx_pr_details_claim_identifier ON payment_reconciliation_details(claim_identifier_value);
CREATE INDEX IF NOT EXISTS idx_pr_details_claim_submission ON payment_reconciliation_details(claim_submission_id);
CREATE INDEX IF NOT EXISTS idx_pr_details_date ON payment_reconciliation_details(detail_date);

-- =====================================================
-- Table 3: payment_reconciliation_components (nphies extensions)
-- Stores the nphies-specific fee components
-- =====================================================
CREATE TABLE IF NOT EXISTS payment_reconciliation_components (
    id SERIAL PRIMARY KEY,
    
    -- Parent detail
    detail_id INTEGER NOT NULL,
    
    -- Component type (based on extension URL)
    component_type VARCHAR(50) NOT NULL,                     -- 'payment' | 'early_fee' | 'nphies_fee' | 'other'
    
    -- Extension URL (for identification and forward compatibility)
    extension_url VARCHAR(500) NOT NULL,                     -- Full extension URL
    
    -- Component amount
    amount DECIMAL(15,2) NOT NULL,                           -- valueMoney.value
    currency VARCHAR(3) DEFAULT 'SAR',                       -- valueMoney.currency
    
    -- Display name (for UI)
    display_name VARCHAR(255),                               -- Human readable name
    
    -- Raw extension data (for any nested extensions)
    raw_extension JSONB,                                     -- Original extension JSON
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Foreign key constraints
    CONSTRAINT fk_component_detail FOREIGN KEY (detail_id) 
        REFERENCES payment_reconciliation_details(id) ON DELETE CASCADE,
    
    -- Ensure one component type per detail
    CONSTRAINT uq_component_per_detail UNIQUE (detail_id, component_type)
);

-- Indexes for component queries
CREATE INDEX IF NOT EXISTS idx_pr_components_detail ON payment_reconciliation_components(detail_id);
CREATE INDEX IF NOT EXISTS idx_pr_components_type ON payment_reconciliation_components(component_type);

-- =====================================================
-- Trigger for updated_at timestamps
-- =====================================================
CREATE OR REPLACE FUNCTION update_payment_reconciliation_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to payment_reconciliations
DROP TRIGGER IF EXISTS trigger_payment_reconciliations_updated_at ON payment_reconciliations;
CREATE TRIGGER trigger_payment_reconciliations_updated_at
    BEFORE UPDATE ON payment_reconciliations
    FOR EACH ROW
    EXECUTE FUNCTION update_payment_reconciliation_updated_at();

-- Apply trigger to payment_reconciliation_details
DROP TRIGGER IF EXISTS trigger_pr_details_updated_at ON payment_reconciliation_details;
CREATE TRIGGER trigger_pr_details_updated_at
    BEFORE UPDATE ON payment_reconciliation_details
    FOR EACH ROW
    EXECUTE FUNCTION update_payment_reconciliation_updated_at();

-- =====================================================
-- Comments for documentation
-- =====================================================
COMMENT ON TABLE payment_reconciliations IS 'Stores nphies PaymentReconciliation resources - payment notifications from insurers to providers';
COMMENT ON TABLE payment_reconciliation_details IS 'Individual payment details within a reconciliation, linked to claims';
COMMENT ON TABLE payment_reconciliation_components IS 'nphies extension components: payment amount, early fee, nphies fee';

COMMENT ON COLUMN payment_reconciliations.fhir_id IS 'PaymentReconciliation.id from FHIR resource';
COMMENT ON COLUMN payment_reconciliations.request_bundle IS 'Original FHIR Bundle received for audit trail';
COMMENT ON COLUMN payment_reconciliations.response_bundle IS 'Acknowledgement Bundle sent back to insurer';

COMMENT ON COLUMN payment_reconciliation_details.claim_identifier_value IS 'Claim identifier to link with claim_submissions table';
COMMENT ON COLUMN payment_reconciliation_details.extensions IS 'Raw JSONB of all extensions for forward compatibility';

COMMENT ON COLUMN payment_reconciliation_components.component_type IS 'payment = actual payment, early_fee = early settlement charge, nphies_fee = nphies service charge';
COMMENT ON COLUMN payment_reconciliation_components.extension_url IS 'Full nphies extension URL for identification';

