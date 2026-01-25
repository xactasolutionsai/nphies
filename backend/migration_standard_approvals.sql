-- Migration script for Standard Approvals tables
-- This script ensures all nullable fields properly allow NULL values
-- Run this in pgAdmin Query Tool on your existing database
-- Note: This script assumes your patients, providers, and insurers tables use UUID primary keys

-- Ensure the update_updated_at_column function exists
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create standard_approvals_claims table if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'standard_approvals_claims') THEN
        -- Create the table if it doesn't exist
        CREATE TABLE standard_approvals_claims (
            id SERIAL PRIMARY KEY,
            form_number VARCHAR(50) UNIQUE,
            patient_id UUID REFERENCES patients(patient_id) ON DELETE SET NULL,
            provider_id UUID REFERENCES providers(provider_id) ON DELETE SET NULL,
            insurer_id UUID REFERENCES insurers(insurer_id) ON DELETE SET NULL,
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
    END IF;
END $$;

-- Create standard_approvals_management_items table if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'standard_approvals_management_items') THEN
        CREATE TABLE standard_approvals_management_items (
            id SERIAL PRIMARY KEY,
            form_id INTEGER REFERENCES standard_approvals_claims(id) ON DELETE CASCADE,
            code VARCHAR(50),
            description VARCHAR(255),
            type VARCHAR(100),
            quantity INTEGER,
            cost DECIMAL(10,2),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    END IF;
END $$;

-- Create standard_approvals_medications table if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'standard_approvals_medications') THEN
        CREATE TABLE standard_approvals_medications (
            id SERIAL PRIMARY KEY,
            form_id INTEGER REFERENCES standard_approvals_claims(id) ON DELETE CASCADE,
            medication_name VARCHAR(255),
            type VARCHAR(100),
            quantity INTEGER,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    END IF;
END $$;

-- Create indexes if they don't exist
CREATE INDEX IF NOT EXISTS idx_standard_approvals_form_number ON standard_approvals_claims(form_number);
CREATE INDEX IF NOT EXISTS idx_standard_approvals_patient_id ON standard_approvals_claims(patient_id);
CREATE INDEX IF NOT EXISTS idx_standard_approvals_provider_id ON standard_approvals_claims(provider_id);
CREATE INDEX IF NOT EXISTS idx_standard_approvals_insurer_id ON standard_approvals_claims(insurer_id);
CREATE INDEX IF NOT EXISTS idx_standard_approvals_status ON standard_approvals_claims(status);
CREATE INDEX IF NOT EXISTS idx_standard_approvals_management_form_id ON standard_approvals_management_items(form_id);
CREATE INDEX IF NOT EXISTS idx_standard_approvals_medications_form_id ON standard_approvals_medications(form_id);

-- Create or replace trigger for updated_at
DROP TRIGGER IF EXISTS update_standard_approvals_claims_updated_at ON standard_approvals_claims;
CREATE TRIGGER update_standard_approvals_claims_updated_at BEFORE UPDATE ON standard_approvals_claims
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Verify the schema
SELECT 
    'Migration completed successfully!' as status,
    (SELECT COUNT(*) FROM information_schema.tables WHERE table_name IN ('standard_approvals_claims', 'standard_approvals_management_items', 'standard_approvals_medications')) as tables_created,
    (SELECT COUNT(*) FROM pg_indexes WHERE tablename IN ('standard_approvals_claims', 'standard_approvals_management_items', 'standard_approvals_medications')) as indexes_created;

