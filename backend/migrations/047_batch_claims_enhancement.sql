-- Migration: Create claim_batches table and add batch support to claim_submissions
-- Date: 2024-12-28
-- Purpose: Support NPHIES Batch Claims use case

-- =====================================================
-- 1. Create claim_batches table (if not exists)
-- =====================================================

CREATE TABLE IF NOT EXISTS claim_batches (
    id SERIAL PRIMARY KEY,
    batch_identifier VARCHAR(100) UNIQUE NOT NULL,
    provider_id UUID REFERENCES providers(provider_id) ON DELETE CASCADE,
    insurer_id UUID REFERENCES insurers(insurer_id) ON DELETE CASCADE,
    status VARCHAR(30) DEFAULT 'Draft' CHECK (status IN ('Draft', 'Pending', 'Submitted', 'Queued', 'Processed', 'Partial', 'Rejected', 'Error', 'Under Review')),
    total_amount DECIMAL(12,2) DEFAULT 0,
    total_claims INTEGER DEFAULT 0,
    processed_claims INTEGER DEFAULT 0,
    approved_claims INTEGER DEFAULT 0,
    rejected_claims INTEGER DEFAULT 0,
    approved_amount DECIMAL(12,2) DEFAULT 0,
    batch_period_start DATE,
    batch_period_end DATE,
    nphies_request_id VARCHAR(100),
    nphies_response_id VARCHAR(100),
    request_bundle JSONB,
    response_bundle JSONB,
    errors JSONB,
    description TEXT,
    submission_date TIMESTAMP,
    processed_date TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- 2. Add columns if they don't exist (for existing tables)
-- =====================================================

DO $$ 
BEGIN
    -- Add approved_amount column if not exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'claim_batches' AND column_name = 'approved_amount') THEN
        ALTER TABLE claim_batches ADD COLUMN approved_amount DECIMAL(12,2) DEFAULT 0;
    END IF;
END $$;

-- =====================================================
-- 3. Add batch_id to claim_submissions table
-- =====================================================

-- Add batch_id column to claim_submissions if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'claim_submissions' AND column_name = 'batch_id') THEN
        ALTER TABLE claim_submissions ADD COLUMN batch_id INTEGER REFERENCES claim_batches(id) ON DELETE SET NULL;
    END IF;

    -- Add batch_number column (position within batch)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'claim_submissions' AND column_name = 'batch_number') THEN
        ALTER TABLE claim_submissions ADD COLUMN batch_number INTEGER;
    END IF;
END $$;

-- Create index for batch_id lookups
CREATE INDEX IF NOT EXISTS idx_claim_submissions_batch_id ON claim_submissions(batch_id);

-- =====================================================
-- 4. Create indexes for better query performance
-- =====================================================

-- Index for batch status queries
CREATE INDEX IF NOT EXISTS idx_claim_batches_status ON claim_batches(status);

-- Index for batch provider queries
CREATE INDEX IF NOT EXISTS idx_claim_batches_provider_id ON claim_batches(provider_id);

-- Index for batch insurer queries
CREATE INDEX IF NOT EXISTS idx_claim_batches_insurer_id ON claim_batches(insurer_id);

-- Index for batch submission date queries
CREATE INDEX IF NOT EXISTS idx_claim_batches_submission_date ON claim_batches(submission_date);

-- =====================================================
-- 5. Add comments for documentation
-- =====================================================

COMMENT ON TABLE claim_batches IS 'Stores NPHIES batch claim submissions. Each batch contains multiple claims for the same insurer.';
COMMENT ON COLUMN claim_batches.batch_identifier IS 'Unique provider-assigned batch identifier';
COMMENT ON COLUMN claim_batches.batch_period_start IS 'Start date of the batch period (NPHIES extension)';
COMMENT ON COLUMN claim_batches.batch_period_end IS 'End date of the batch period (NPHIES extension)';
COMMENT ON COLUMN claim_batches.nphies_request_id IS 'NPHIES message ID from request';
COMMENT ON COLUMN claim_batches.nphies_response_id IS 'NPHIES message ID from response';
COMMENT ON COLUMN claim_batches.request_bundle IS 'The FHIR Bundle sent to NPHIES';
COMMENT ON COLUMN claim_batches.response_bundle IS 'The FHIR Bundle received from NPHIES';
COMMENT ON COLUMN claim_batches.total_claims IS 'Total number of claims in the batch';
COMMENT ON COLUMN claim_batches.processed_claims IS 'Number of claims that have been processed';
COMMENT ON COLUMN claim_batches.approved_claims IS 'Number of claims approved';
COMMENT ON COLUMN claim_batches.rejected_claims IS 'Number of claims rejected';

COMMENT ON COLUMN claim_submissions.batch_id IS 'Reference to the batch this claim belongs to (if submitted as part of a batch)';
COMMENT ON COLUMN claim_submissions.batch_number IS 'The claim number within the batch (1-based index)';
