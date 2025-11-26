-- Reset database for new UUID schema
-- This will drop all existing tables and recreate them

-- Drop all tables in the correct order (respecting foreign key constraints)
DROP TABLE IF EXISTS payments CASCADE;
DROP TABLE IF EXISTS claims CASCADE;
DROP TABLE IF EXISTS claim_batches CASCADE;
DROP TABLE IF EXISTS eligibility_requests CASCADE;
DROP TABLE IF EXISTS authorizations CASCADE;
DROP TABLE IF EXISTS patients CASCADE;
DROP TABLE IF EXISTS providers CASCADE;
DROP TABLE IF EXISTS insurers CASCADE;

-- Drop views
DROP VIEW IF EXISTS patient_summary CASCADE;
DROP VIEW IF EXISTS provider_summary CASCADE;
DROP VIEW IF EXISTS insurer_summary CASCADE;

-- Drop function
DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create Patients table
CREATE TABLE patients (
    id SERIAL PRIMARY KEY,
    patient_id UUID UNIQUE NOT NULL DEFAULT uuid_generate_v4(),
    nphies_id VARCHAR(20) UNIQUE NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    gender VARCHAR(10) NOT NULL CHECK (gender IN ('Male', 'Female', 'Other')),
    date_of_birth DATE NOT NULL,
    newborn_flag BOOLEAN DEFAULT FALSE,
    transfer_flag BOOLEAN DEFAULT FALSE,
    phone VARCHAR(20),
    email VARCHAR(255),
    address TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create Providers table
CREATE TABLE providers (
    id SERIAL PRIMARY KEY,
    provider_id UUID UNIQUE NOT NULL DEFAULT uuid_generate_v4(),
    nphies_id VARCHAR(20) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL,
    address TEXT,
    phone VARCHAR(20),
    email VARCHAR(255),
    contact_person VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create Insurers table
CREATE TABLE insurers (
    id SERIAL PRIMARY KEY,
    insurer_id UUID UNIQUE NOT NULL DEFAULT uuid_generate_v4(),
    nphies_id VARCHAR(20) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    status VARCHAR(20) DEFAULT 'Active' CHECK (status IN ('Active', 'Inactive', 'Suspended')),
    contact_person VARCHAR(255),
    phone VARCHAR(20),
    email VARCHAR(255),
    address TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create Authorizations table
CREATE TABLE authorizations (
    id SERIAL PRIMARY KEY,
    authorization_id UUID UNIQUE NOT NULL DEFAULT uuid_generate_v4(),
    patient_id UUID REFERENCES patients(patient_id) ON DELETE CASCADE,
    provider_id UUID REFERENCES providers(provider_id) ON DELETE CASCADE,
    insurer_id UUID REFERENCES insurers(insurer_id) ON DELETE CASCADE,
    request_date TIMESTAMP NOT NULL,
    service_start_date TIMESTAMP,
    auth_status VARCHAR(20) NOT NULL CHECK (auth_status IN ('approved', 'denied', 'pending', 'under_review')),
    auth_number VARCHAR(50) UNIQUE NOT NULL,
    purpose VARCHAR(255),
    amount DECIMAL(10,2),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create Eligibility Requests table
CREATE TABLE eligibility_requests (
    id SERIAL PRIMARY KEY,
    eligibility_request_id UUID UNIQUE NOT NULL DEFAULT uuid_generate_v4(),
    patient_id UUID REFERENCES patients(patient_id) ON DELETE CASCADE,
    provider_id UUID REFERENCES providers(provider_id) ON DELETE CASCADE,
    insurer_id UUID REFERENCES insurers(insurer_id) ON DELETE CASCADE,
    request_date TIMESTAMP NOT NULL,
    request_purpose VARCHAR(100),
    response_status VARCHAR(20) NOT NULL CHECK (response_status IN ('active', 'inactive', 'pending', 'expired')),
    coverage_code VARCHAR(10),
    service_code VARCHAR(10),
    policy_number VARCHAR(50),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create Claims table
CREATE TABLE claims (
    id SERIAL PRIMARY KEY,
    claim_id UUID UNIQUE NOT NULL DEFAULT uuid_generate_v4(),
    claim_number VARCHAR(50) UNIQUE NOT NULL,
    patient_id UUID REFERENCES patients(patient_id) ON DELETE CASCADE,
    provider_id UUID REFERENCES providers(provider_id) ON DELETE CASCADE,
    insurer_id UUID REFERENCES insurers(insurer_id) ON DELETE CASCADE,
    authorization_id UUID REFERENCES authorizations(authorization_id) ON DELETE SET NULL,
    service_date TIMESTAMP NOT NULL,
    claim_status VARCHAR(20) NOT NULL CHECK (claim_status IN ('submitted', 'adjudicated', 'denied', 'paid', 'pending')),
    service_type VARCHAR(100),
    amount DECIMAL(10,2) NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create Claim Batches table
CREATE TABLE claim_batches (
    id SERIAL PRIMARY KEY,
    claims_batch_id UUID UNIQUE NOT NULL DEFAULT uuid_generate_v4(),
    batch_identifier VARCHAR(50) UNIQUE NOT NULL,
    submission_date TIMESTAMP NOT NULL,
    status VARCHAR(20) NOT NULL CHECK (status IN ('sent', 'processed', 'failed', 'pending')),
    total_amount DECIMAL(12,2),
    claim_count INTEGER DEFAULT 0,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create Payments table
CREATE TABLE payments (
    id SERIAL PRIMARY KEY,
    payment_id UUID UNIQUE NOT NULL DEFAULT uuid_generate_v4(),
    payment_ref_number VARCHAR(50) UNIQUE NOT NULL,
    claim_id UUID REFERENCES claims(claim_id) ON DELETE SET NULL,
    provider_id UUID REFERENCES providers(provider_id) ON DELETE CASCADE,
    insurer_id UUID REFERENCES insurers(insurer_id) ON DELETE CASCADE,
    payment_date TIMESTAMP NOT NULL,
    total_paid_amount DECIMAL(10,2) NOT NULL,
    payment_status VARCHAR(20) NOT NULL CHECK (payment_status IN ('completed', 'pending', 'failed', 'processing')),
    payment_method VARCHAR(50),
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX idx_patients_patient_id ON patients(patient_id);
CREATE INDEX idx_patients_nphies_id ON patients(nphies_id);
CREATE INDEX idx_patients_name ON patients(first_name, last_name);
CREATE INDEX idx_patients_newborn ON patients(newborn_flag);
CREATE INDEX idx_patients_transfer ON patients(transfer_flag);

CREATE INDEX idx_providers_provider_id ON providers(provider_id);
CREATE INDEX idx_providers_nphies_id ON providers(nphies_id);
CREATE INDEX idx_providers_type ON providers(type);

CREATE INDEX idx_insurers_insurer_id ON insurers(insurer_id);
CREATE INDEX idx_insurers_nphies_id ON insurers(nphies_id);
CREATE INDEX idx_insurers_status ON insurers(status);

CREATE INDEX idx_authorizations_auth_id ON authorizations(authorization_id);
CREATE INDEX idx_authorizations_patient ON authorizations(patient_id);
CREATE INDEX idx_authorizations_provider ON authorizations(provider_id);
CREATE INDEX idx_authorizations_insurer ON authorizations(insurer_id);
CREATE INDEX idx_authorizations_status ON authorizations(auth_status);

CREATE INDEX idx_eligibility_request_id ON eligibility_requests(eligibility_request_id);
CREATE INDEX idx_eligibility_patient ON eligibility_requests(patient_id);
CREATE INDEX idx_eligibility_provider ON eligibility_requests(provider_id);
CREATE INDEX idx_eligibility_insurer ON eligibility_requests(insurer_id);
CREATE INDEX idx_eligibility_status ON eligibility_requests(response_status);

CREATE INDEX idx_claims_claim_id ON claims(claim_id);
CREATE INDEX idx_claims_claim_number ON claims(claim_number);
CREATE INDEX idx_claims_patient ON claims(patient_id);
CREATE INDEX idx_claims_provider ON claims(provider_id);
CREATE INDEX idx_claims_insurer ON claims(insurer_id);
CREATE INDEX idx_claims_authorization ON claims(authorization_id);
CREATE INDEX idx_claims_status ON claims(claim_status);

CREATE INDEX idx_claim_batches_batch_id ON claim_batches(claims_batch_id);
CREATE INDEX idx_claim_batches_identifier ON claim_batches(batch_identifier);
CREATE INDEX idx_claim_batches_status ON claim_batches(status);

CREATE INDEX idx_payments_payment_id ON payments(payment_id);
CREATE INDEX idx_payments_ref_number ON payments(payment_ref_number);
CREATE INDEX idx_payments_claim ON payments(claim_id);
CREATE INDEX idx_payments_provider ON payments(provider_id);
CREATE INDEX idx_payments_insurer ON payments(insurer_id);
CREATE INDEX idx_payments_status ON payments(payment_status);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers to automatically update updated_at
CREATE TRIGGER update_patients_updated_at BEFORE UPDATE ON patients
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_providers_updated_at BEFORE UPDATE ON providers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_insurers_updated_at BEFORE UPDATE ON insurers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_authorizations_updated_at BEFORE UPDATE ON authorizations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_eligibility_updated_at BEFORE UPDATE ON eligibility_requests
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_claims_updated_at BEFORE UPDATE ON claims
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_claim_batches_updated_at BEFORE UPDATE ON claim_batches
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_payments_updated_at BEFORE UPDATE ON payments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create views for common queries
CREATE OR REPLACE VIEW patient_summary AS
SELECT 
    p.patient_id,
    p.nphies_id,
    p.first_name,
    p.last_name,
    p.gender,
    p.date_of_birth,
    p.newborn_flag,
    p.transfer_flag,
    COUNT(DISTINCT c.claim_id) as total_claims,
    COUNT(DISTINCT a.authorization_id) as total_authorizations,
    COUNT(DISTINCT e.eligibility_request_id) as total_eligibility_requests,
    COALESCE(SUM(c.amount), 0) as total_claim_amount
FROM patients p
LEFT JOIN claims c ON p.patient_id = c.patient_id
LEFT JOIN authorizations a ON p.patient_id = a.patient_id
LEFT JOIN eligibility_requests e ON p.patient_id = e.patient_id
GROUP BY p.patient_id, p.nphies_id, p.first_name, p.last_name, p.gender, p.date_of_birth, p.newborn_flag, p.transfer_flag;

CREATE OR REPLACE VIEW provider_summary AS
SELECT 
    pr.provider_id,
    pr.nphies_id,
    pr.name,
    pr.type,
    COUNT(DISTINCT c.claim_id) as total_claims,
    COALESCE(SUM(c.amount), 0) as total_claim_amount,
    COUNT(DISTINCT p.payment_id) as total_payments,
    COALESCE(SUM(p.total_paid_amount), 0) as total_payment_amount
FROM providers pr
LEFT JOIN claims c ON pr.provider_id = c.provider_id
LEFT JOIN payments p ON pr.provider_id = p.provider_id
GROUP BY pr.provider_id, pr.nphies_id, pr.name, pr.type;

CREATE OR REPLACE VIEW insurer_summary AS
SELECT 
    i.insurer_id,
    i.nphies_id,
    i.name,
    i.status,
    COUNT(DISTINCT c.claim_id) as total_claims,
    COALESCE(SUM(c.amount), 0) as total_claim_amount,
    COUNT(DISTINCT p.payment_id) as total_payments,
    COALESCE(SUM(p.total_paid_amount), 0) as total_payment_amount
FROM insurers i
LEFT JOIN claims c ON i.insurer_id = c.insurer_id
LEFT JOIN payments p ON i.insurer_id = p.insurer_id
GROUP BY i.insurer_id, i.nphies_id, i.name, i.status;

COMMIT;
