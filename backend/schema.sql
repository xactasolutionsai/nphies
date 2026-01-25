-- Nafes Healthcare Management System Database Schema
-- PostgreSQL Database Schema for the Healthcare Management System

-- Create database (run this separately)
-- CREATE DATABASE nafes_healthcare;

-- Connect to the database
-- \c nafes_healthcare;

-- Enable UUID extension (optional, for future use)
-- CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create Patients table
CREATE TABLE IF NOT EXISTS patients (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    identifier VARCHAR(50) UNIQUE NOT NULL,
    gender VARCHAR(10) NOT NULL CHECK (gender IN ('Male', 'Female', 'Other', 'Unknown')),
    birth_date DATE NOT NULL,
    phone VARCHAR(20),
    email VARCHAR(255),
    address TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create Providers table
CREATE TABLE IF NOT EXISTS providers (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(100) NOT NULL,
    nphies_id VARCHAR(50) UNIQUE NOT NULL,
    address TEXT,
    phone VARCHAR(20),
    email VARCHAR(255),
    contact_person VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create Insurers table
CREATE TABLE IF NOT EXISTS insurers (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    nphies_id VARCHAR(50) UNIQUE NOT NULL,
    status VARCHAR(20) DEFAULT 'Active' CHECK (status IN ('Active', 'Inactive', 'Suspended')),
    contact_person VARCHAR(255),
    phone VARCHAR(20),
    email VARCHAR(255),
    address TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create Authorizations table
CREATE TABLE IF NOT EXISTS authorizations (
    id SERIAL PRIMARY KEY,
    status VARCHAR(20) NOT NULL CHECK (status IN ('Approved', 'Pending', 'Rejected', 'Under Review')),
    purpose VARCHAR(255) NOT NULL,
    patient_id INTEGER REFERENCES patients(id) ON DELETE CASCADE,
    provider_id INTEGER REFERENCES providers(id) ON DELETE CASCADE,
    insurer_id INTEGER REFERENCES insurers(id) ON DELETE CASCADE,
    amount DECIMAL(10,2),
    request_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    approval_date TIMESTAMP,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create Eligibility table
CREATE TABLE IF NOT EXISTS eligibility (
    id SERIAL PRIMARY KEY,
    purpose VARCHAR(255) NOT NULL,
    patient_id INTEGER REFERENCES patients(id) ON DELETE CASCADE,
    provider_id INTEGER REFERENCES providers(id) ON DELETE CASCADE,
    insurer_id INTEGER REFERENCES insurers(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL CHECK (status IN ('Eligible', 'Not Eligible', 'Pending', 'Under Review')),
    coverage VARCHAR(20),
    request_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    response_date TIMESTAMP,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create Claims table
CREATE TABLE IF NOT EXISTS claims (
    id SERIAL PRIMARY KEY,
    claim_number VARCHAR(50) UNIQUE NOT NULL,
    patient_id INTEGER REFERENCES patients(id) ON DELETE CASCADE,
    provider_id INTEGER REFERENCES providers(id) ON DELETE CASCADE,
    insurer_id INTEGER REFERENCES insurers(id) ON DELETE CASCADE,
    authorization_id INTEGER REFERENCES authorizations(id) ON DELETE SET NULL,
    claim_batch_id INTEGER, -- Will be added after claim_batches table
    status VARCHAR(20) NOT NULL CHECK (status IN ('Approved', 'Pending', 'Rejected', 'Under Review')),
    amount DECIMAL(10,2) NOT NULL,
    submission_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    processed_date TIMESTAMP,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create Claim Batches table
CREATE TABLE IF NOT EXISTS claim_batches (
    id SERIAL PRIMARY KEY,
    batch_identifier VARCHAR(50) UNIQUE NOT NULL,
    provider_id INTEGER REFERENCES providers(id) ON DELETE CASCADE,
    insurer_id INTEGER REFERENCES insurers(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL CHECK (status IN ('Processed', 'Pending', 'Rejected', 'Under Review')),
    total_amount DECIMAL(12,2),
    submission_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    processed_date TIMESTAMP,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add foreign key constraint for claim_batch_id in claims table
ALTER TABLE claims ADD CONSTRAINT fk_claims_claim_batch 
    FOREIGN KEY (claim_batch_id) REFERENCES claim_batches(id) ON DELETE SET NULL;

-- Create Payments table
CREATE TABLE IF NOT EXISTS payments (
    id SERIAL PRIMARY KEY,
    payment_ref_number VARCHAR(50) UNIQUE NOT NULL,
    provider_id INTEGER REFERENCES providers(id) ON DELETE CASCADE,
    insurer_id INTEGER REFERENCES insurers(id) ON DELETE CASCADE,
    claim_id INTEGER REFERENCES claims(id) ON DELETE SET NULL,
    total_amount DECIMAL(10,2) NOT NULL,
    payment_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(20) NOT NULL CHECK (status IN ('Completed', 'Pending', 'Failed', 'Processing')),
    method VARCHAR(50),
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_patients_identifier ON patients(identifier);
CREATE INDEX IF NOT EXISTS idx_patients_name ON patients(name);
CREATE INDEX IF NOT EXISTS idx_providers_nphies_id ON providers(nphies_id);
CREATE INDEX IF NOT EXISTS idx_providers_name ON providers(name);
CREATE INDEX IF NOT EXISTS idx_insurers_nphies_id ON insurers(nphies_id);
CREATE INDEX IF NOT EXISTS idx_insurers_name ON insurers(name);
CREATE INDEX IF NOT EXISTS idx_authorizations_patient_id ON authorizations(patient_id);
CREATE INDEX IF NOT EXISTS idx_authorizations_provider_id ON authorizations(provider_id);
CREATE INDEX IF NOT EXISTS idx_authorizations_insurer_id ON authorizations(insurer_id);
CREATE INDEX IF NOT EXISTS idx_authorizations_status ON authorizations(status);
CREATE INDEX IF NOT EXISTS idx_eligibility_patient_id ON eligibility(patient_id);
CREATE INDEX IF NOT EXISTS idx_eligibility_provider_id ON eligibility(provider_id);
CREATE INDEX IF NOT EXISTS idx_eligibility_insurer_id ON eligibility(insurer_id);
CREATE INDEX IF NOT EXISTS idx_eligibility_status ON eligibility(status);
CREATE INDEX IF NOT EXISTS idx_claims_claim_number ON claims(claim_number);
CREATE INDEX IF NOT EXISTS idx_claims_patient_id ON claims(patient_id);
CREATE INDEX IF NOT EXISTS idx_claims_provider_id ON claims(provider_id);
CREATE INDEX IF NOT EXISTS idx_claims_insurer_id ON claims(insurer_id);
CREATE INDEX IF NOT EXISTS idx_claims_status ON claims(status);
CREATE INDEX IF NOT EXISTS idx_claims_claim_batch_id ON claims(claim_batch_id);
CREATE INDEX IF NOT EXISTS idx_claim_batches_batch_identifier ON claim_batches(batch_identifier);
CREATE INDEX IF NOT EXISTS idx_claim_batches_provider_id ON claim_batches(provider_id);
CREATE INDEX IF NOT EXISTS idx_claim_batches_insurer_id ON claim_batches(insurer_id);
CREATE INDEX IF NOT EXISTS idx_claim_batches_status ON claim_batches(status);
CREATE INDEX IF NOT EXISTS idx_payments_payment_ref_number ON payments(payment_ref_number);
CREATE INDEX IF NOT EXISTS idx_payments_provider_id ON payments(provider_id);
CREATE INDEX IF NOT EXISTS idx_payments_insurer_id ON payments(insurer_id);
CREATE INDEX IF NOT EXISTS idx_payments_claim_id ON payments(claim_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);

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

CREATE TRIGGER update_eligibility_updated_at BEFORE UPDATE ON eligibility
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_claims_updated_at BEFORE UPDATE ON claims
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_claim_batches_updated_at BEFORE UPDATE ON claim_batches
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_payments_updated_at BEFORE UPDATE ON payments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create Standard Approvals and Claims Request Form tables
CREATE TABLE IF NOT EXISTS standard_approvals_claims (
    id SERIAL PRIMARY KEY,
    form_number VARCHAR(50) UNIQUE,
    patient_id INTEGER REFERENCES patients(id) ON DELETE SET NULL,
    provider_id INTEGER REFERENCES providers(id) ON DELETE SET NULL,
    insurer_id INTEGER REFERENCES insurers(id) ON DELETE SET NULL,
    status VARCHAR(20) DEFAULT 'Draft' CHECK (status IN ('Draft', 'Submitted', 'Approved', 'Rejected', 'Pending')),
    
    -- Section 1: Reception/Nurse Fields
    provider_name VARCHAR(255),
    insurance_company_name VARCHAR(255),
    tpa_company_name VARCHAR(255),
    patient_file_number VARCHAR(50),
    department VARCHAR(100),
    marital_status VARCHAR(20) CHECK (marital_status IN ('A', 'D', 'I', 'L', 'M', 'P', 'S', 'T', 'W', 'U')),
    plan_type VARCHAR(100),
    date_of_visit DATE,
    visit_type VARCHAR(50) CHECK (visit_type IN ('New visit', 'Follow Up', 'Refill', 'walk in', 'Referral')),
    
    -- Section 2: Insured Information
    insured_name VARCHAR(255),
    id_card_number VARCHAR(50),
    sex VARCHAR(10),
    age INTEGER,
    policy_holder VARCHAR(255),
    policy_number VARCHAR(50),
    expiry_date DATE,
    approval_field VARCHAR(255),
    
    -- Section 3: Attending Physician
    patient_type VARCHAR(20) CHECK (patient_type IN ('Inpatient', 'Outpatient')),
    emergency_case BOOLEAN DEFAULT FALSE,
    emergency_care_level INTEGER CHECK (emergency_care_level IN (1, 2, 3)),
    bp VARCHAR(20),
    pulse INTEGER,
    temp DECIMAL(5,2),
    weight DECIMAL(5,2),
    height DECIMAL(5,2),
    respiratory_rate INTEGER,
    duration_of_illness_days INTEGER,
    chief_complaints TEXT,
    significant_signs TEXT,
    other_conditions TEXT,
    diagnosis TEXT,
    principal_code VARCHAR(50),
    second_code VARCHAR(50),
    third_code VARCHAR(50),
    fourth_code VARCHAR(50),
    chronic BOOLEAN DEFAULT FALSE,
    congenital BOOLEAN DEFAULT FALSE,
    rta BOOLEAN DEFAULT FALSE,
    work_related BOOLEAN DEFAULT FALSE,
    vaccination BOOLEAN DEFAULT FALSE,
    check_up BOOLEAN DEFAULT FALSE,
    psychiatric BOOLEAN DEFAULT FALSE,
    infertility BOOLEAN DEFAULT FALSE,
    pregnancy BOOLEAN DEFAULT FALSE,
    completed_coded_by VARCHAR(255),
    provider_signature VARCHAR(255),
    provider_date DATE,
    case_management_form_included BOOLEAN DEFAULT FALSE,
    possible_line_of_management TEXT,
    estimated_length_of_stay_days INTEGER,
    expected_date_of_admission DATE,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS standard_approvals_management_items (
    id SERIAL PRIMARY KEY,
    form_id INTEGER REFERENCES standard_approvals_claims(id) ON DELETE CASCADE,
    code VARCHAR(50),
    description VARCHAR(255),
    type VARCHAR(100),
    quantity INTEGER,
    cost DECIMAL(10,2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS standard_approvals_medications (
    id SERIAL PRIMARY KEY,
    form_id INTEGER REFERENCES standard_approvals_claims(id) ON DELETE CASCADE,
    medication_name VARCHAR(255),
    type VARCHAR(100),
    quantity INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for standard approvals tables
CREATE INDEX IF NOT EXISTS idx_standard_approvals_form_number ON standard_approvals_claims(form_number);
CREATE INDEX IF NOT EXISTS idx_standard_approvals_patient_id ON standard_approvals_claims(patient_id);
CREATE INDEX IF NOT EXISTS idx_standard_approvals_provider_id ON standard_approvals_claims(provider_id);
CREATE INDEX IF NOT EXISTS idx_standard_approvals_insurer_id ON standard_approvals_claims(insurer_id);
CREATE INDEX IF NOT EXISTS idx_standard_approvals_status ON standard_approvals_claims(status);
CREATE INDEX IF NOT EXISTS idx_standard_approvals_management_form_id ON standard_approvals_management_items(form_id);
CREATE INDEX IF NOT EXISTS idx_standard_approvals_medications_form_id ON standard_approvals_medications(form_id);

-- Create trigger for updated_at on standard_approvals_claims
CREATE TRIGGER update_standard_approvals_claims_updated_at BEFORE UPDATE ON standard_approvals_claims
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert sample data for testing
INSERT INTO patients (name, identifier, gender, birth_date, phone, email, address) VALUES
('أحمد محمد العلي', '1234567890', 'Male', '1985-03-15', '+966501234567', 'ahmed.ali@example.com', 'الرياض، المملكة العربية السعودية'),
('فاطمة عبدالله السعد', '0987654321', 'Female', '1990-07-22', '+966502345678', 'fatima.saad@example.com', 'جدة، المملكة العربية السعودية'),
('محمد خالد القحطاني', '1122334455', 'Male', '1978-12-10', '+966503456789', 'mohammed.qhtani@example.com', 'الدمام، المملكة العربية السعودية')
ON CONFLICT (identifier) DO NOTHING;

INSERT INTO providers (name, type, nphies_id, address, phone, email, contact_person) VALUES
('مستشفى الملك فهد التخصصي', 'Hospital', 'HOSP001', 'الرياض، المملكة العربية السعودية', '+966112345678', 'info@kfsh.med.sa', 'د. أحمد محمد'),
('عيادة الدكتور أحمد محمد', 'Clinic', 'CLIN001', 'جدة، المملكة العربية السعودية', '+966123456789', 'dr.ahmed@clinic.com', 'د. أحمد محمد'),
('مركز الأسنان المتخصص', 'Dental Center', 'DENT001', 'الدمام، المملكة العربية السعودية', '+966134567890', 'info@dentalcenter.com', 'د. سارة أحمد')
ON CONFLICT (nphies_id) DO NOTHING;

INSERT INTO insurers (name, nphies_id, status, contact_person, phone, email, address) VALUES
('التأمين الصحي السعودي', 'INS001', 'Active', 'أحمد محمد العلي', '+966112345678', 'info@shic.gov.sa', 'الرياض، المملكة العربية السعودية'),
('بوبا العربية للتأمين', 'INS002', 'Active', 'سارة أحمد السعد', '+966123456789', 'info@bupa.com.sa', 'جدة، المملكة العربية السعودية'),
('تأمين مدجلف', 'INS003', 'Active', 'محمد خالد القحطاني', '+966134567890', 'info@medgulf.com.sa', 'الدمام، المملكة العربية السعودية')
ON CONFLICT (nphies_id) DO NOTHING;

-- Insert sample authorizations
INSERT INTO authorizations (status, purpose, patient_id, provider_id, insurer_id, amount, notes) VALUES
('Approved', 'Surgery', 1, 1, 1, 15000.00, 'Approved for cardiac surgery'),
('Pending', 'Consultation', 2, 2, 2, 500.00, 'Pending review'),
('Rejected', 'Dental Treatment', 3, 3, 3, 2000.00, 'Not covered under current plan')
ON CONFLICT DO NOTHING;

-- Insert sample eligibility records
INSERT INTO eligibility (purpose, patient_id, provider_id, insurer_id, status, coverage, notes) VALUES
('General Checkup', 1, 1, 1, 'Eligible', '100%', 'Patient is eligible for general checkup'),
('Emergency Treatment', 2, 2, 2, 'Eligible', '90%', 'Emergency coverage available'),
('Specialist Consultation', 3, 3, 3, 'Not Eligible', '0%', 'Specialist not covered')
ON CONFLICT DO NOTHING;

-- Insert sample claims
INSERT INTO claims (claim_number, patient_id, provider_id, insurer_id, authorization_id, status, amount, description) VALUES
('CLM001', 1, 1, 1, 1, 'Approved', 15000.00, 'Cardiac surgery claim'),
('CLM002', 2, 2, 2, 2, 'Pending', 500.00, 'Consultation claim'),
('CLM003', 3, 3, 3, 3, 'Rejected', 2000.00, 'Dental treatment claim')
ON CONFLICT (claim_number) DO NOTHING;

-- Insert sample claim batches
INSERT INTO claim_batches (batch_identifier, provider_id, insurer_id, status, total_amount, description) VALUES
('BATCH001', 1, 1, 'Processed', 125000.00, 'Monthly batch for King Fahd Hospital'),
('BATCH002', 2, 2, 'Pending', 75000.00, 'Weekly batch for Dr. Ahmed Clinic'),
('BATCH003', 3, 3, 'Rejected', 40000.00, 'Dental center batch')
ON CONFLICT (batch_identifier) DO NOTHING;

-- Insert sample payments
INSERT INTO payments (payment_ref_number, provider_id, insurer_id, claim_id, total_amount, status, method, description) VALUES
('PAY001', 1, 1, 1, 15000.00, 'Completed', 'Bank Transfer', 'Payment for cardiac surgery'),
('PAY002', 2, 2, 2, 500.00, 'Pending', 'Bank Transfer', 'Payment for consultation'),
('PAY003', 3, 3, 3, 2000.00, 'Failed', 'Bank Transfer', 'Payment for dental treatment')
ON CONFLICT (payment_ref_number) DO NOTHING;

-- Create views for common queries
CREATE OR REPLACE VIEW patient_summary AS
SELECT 
    p.id,
    p.name,
    p.identifier,
    p.gender,
    p.birth_date,
    COUNT(DISTINCT c.id) as total_claims,
    COUNT(DISTINCT a.id) as total_authorizations,
    COALESCE(SUM(c.amount), 0) as total_claim_amount
FROM patients p
LEFT JOIN claims c ON p.id = c.patient_id
LEFT JOIN authorizations a ON p.id = a.patient_id
GROUP BY p.id, p.name, p.identifier, p.gender, p.birth_date;

CREATE OR REPLACE VIEW provider_summary AS
SELECT 
    pr.id,
    pr.name,
    pr.type,
    pr.nphies_id,
    COUNT(DISTINCT c.id) as total_claims,
    COALESCE(SUM(c.amount), 0) as total_claim_amount,
    COUNT(DISTINCT p.id) as total_payments,
    COALESCE(SUM(p.total_amount), 0) as total_payment_amount
FROM providers pr
LEFT JOIN claims c ON pr.id = c.provider_id
LEFT JOIN payments p ON pr.id = p.provider_id
GROUP BY pr.id, pr.name, pr.type, pr.nphies_id;

CREATE OR REPLACE VIEW insurer_summary AS
SELECT 
    i.id,
    i.name,
    i.nphies_id,
    i.status,
    COUNT(DISTINCT c.id) as total_claims,
    COALESCE(SUM(c.amount), 0) as total_claim_amount,
    COUNT(DISTINCT p.id) as total_payments,
    COALESCE(SUM(p.total_amount), 0) as total_payment_amount
FROM insurers i
LEFT JOIN claims c ON i.id = c.insurer_id
LEFT JOIN payments p ON i.id = p.insurer_id
GROUP BY i.id, i.name, i.nphies_id, i.status;

-- Grant permissions (adjust as needed for your setup)
-- GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO your_app_user;
-- GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO your_app_user;

COMMIT;
