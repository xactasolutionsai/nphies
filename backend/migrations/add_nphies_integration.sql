-- NPHIES Eligibility Integration Migration
-- Run this in pgAdmin Query Tool
-- Date: 2025-11-24

-- 1. Add nphies_id columns to existing tables
ALTER TABLE providers ADD COLUMN IF NOT EXISTS nphies_id VARCHAR(50);
ALTER TABLE providers ADD COLUMN IF NOT EXISTS provider_type VARCHAR(20);
ALTER TABLE providers ADD COLUMN IF NOT EXISTS location_license VARCHAR(50);

ALTER TABLE insurers ADD COLUMN IF NOT EXISTS nphies_id VARCHAR(50);

-- 2. Update patients table for NPHIES requirements
ALTER TABLE patients ADD COLUMN IF NOT EXISTS identifier_type VARCHAR(20) DEFAULT 'national_id';
ALTER TABLE patients ADD COLUMN IF NOT EXISTS nationality VARCHAR(3) DEFAULT 'SAU';
ALTER TABLE patients ADD COLUMN IF NOT EXISTS marital_status VARCHAR(20);

-- 3. Create patient_coverage table for insurance policies
CREATE TABLE IF NOT EXISTS patient_coverage (
    coverage_id SERIAL PRIMARY KEY,
    patient_id INTEGER REFERENCES patients(patient_id) ON DELETE CASCADE,
    insurer_id INTEGER REFERENCES insurers(insurer_id),
    policy_number VARCHAR(100) NOT NULL,
    member_id VARCHAR(100),
    coverage_type VARCHAR(50) DEFAULT 'EHCPOL',
    relationship VARCHAR(20) DEFAULT 'self',
    dependent_number VARCHAR(10),
    plan_name VARCHAR(255),
    network_type VARCHAR(50),
    start_date DATE,
    end_date DATE,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. Update eligibility table for NPHIES integration
ALTER TABLE eligibility ADD COLUMN IF NOT EXISTS coverage_id INTEGER REFERENCES patient_coverage(coverage_id);
ALTER TABLE eligibility ADD COLUMN IF NOT EXISTS nphies_request_id VARCHAR(100);
ALTER TABLE eligibility ADD COLUMN IF NOT EXISTS nphies_response_id VARCHAR(100);
ALTER TABLE eligibility ADD COLUMN IF NOT EXISTS raw_request JSONB;
ALTER TABLE eligibility ADD COLUMN IF NOT EXISTS raw_response JSONB;
ALTER TABLE eligibility ADD COLUMN IF NOT EXISTS outcome VARCHAR(20);
ALTER TABLE eligibility ADD COLUMN IF NOT EXISTS inforce BOOLEAN;
ALTER TABLE eligibility ADD COLUMN IF NOT EXISTS error_codes JSONB;
ALTER TABLE eligibility ADD COLUMN IF NOT EXISTS benefits JSONB;
ALTER TABLE eligibility ADD COLUMN IF NOT EXISTS serviced_date DATE;

-- 5. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_providers_nphies_id ON providers(nphies_id);
CREATE INDEX IF NOT EXISTS idx_insurers_nphies_id ON insurers(nphies_id);
CREATE INDEX IF NOT EXISTS idx_patients_identifier ON patients(identifier);
CREATE INDEX IF NOT EXISTS idx_patient_coverage_patient ON patient_coverage(patient_id);
CREATE INDEX IF NOT EXISTS idx_patient_coverage_policy ON patient_coverage(policy_number);
CREATE INDEX IF NOT EXISTS idx_eligibility_nphies_request ON eligibility(nphies_request_id);
CREATE INDEX IF NOT EXISTS idx_eligibility_outcome ON eligibility(outcome);

-- 6. Insert sample test data for development
-- Update existing providers with NPHIES test IDs
UPDATE providers SET nphies_id = 'provider-license' WHERE nphies_id IS NULL AND provider_id = (SELECT MIN(provider_id) FROM providers);

-- Update existing insurers with NPHIES test IDs
UPDATE insurers SET nphies_id = 'payer-license' WHERE nphies_id IS NULL AND insurer_id = (SELECT MIN(insurer_id) FROM insurers);

-- Insert sample coverage for testing (adjust patient_id and insurer_id as needed)
INSERT INTO patient_coverage (patient_id, insurer_id, policy_number, member_id, relationship, start_date, end_date)
SELECT 
    p.patient_id,
    i.insurer_id,
    'POL-' || p.patient_id,
    'MEM-' || p.patient_id,
    'self',
    CURRENT_DATE - INTERVAL '1 year',
    CURRENT_DATE + INTERVAL '1 year'
FROM patients p
CROSS JOIN insurers i
WHERE NOT EXISTS (SELECT 1 FROM patient_coverage pc WHERE pc.patient_id = p.patient_id)
LIMIT 5;

-- Success message
SELECT 'NPHIES Integration Migration Completed Successfully!' as status;

