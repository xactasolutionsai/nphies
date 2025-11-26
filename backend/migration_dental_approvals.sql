-- Migration script for Dental Approvals tables
-- This script creates tables for the Dental Approvals and Claims Application module
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

-- Create dental_approvals table if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'dental_approvals') THEN
        -- Create the main dental approvals table
        CREATE TABLE dental_approvals (
            id SERIAL PRIMARY KEY,
            form_number VARCHAR(50) UNIQUE,
            patient_id UUID REFERENCES patients(patient_id) ON DELETE SET NULL,
            provider_id UUID REFERENCES providers(provider_id) ON DELETE SET NULL,
            insurer_id UUID REFERENCES insurers(insurer_id) ON DELETE SET NULL,
            status VARCHAR(20) DEFAULT 'Draft' CHECK (status IN ('Draft', 'Submitted', 'Approved', 'Rejected', 'Pending')),
            
            -- Section 1: Reception/Nurse Fields (To be completed & ID verified by the reception/nurse)
            provider_name VARCHAR(255),
            insurance_company_name VARCHAR(255),
            tpa_company_name VARCHAR(255),
            patient_file_number VARCHAR(50),
            date_of_visit DATE,
            plan_type VARCHAR(100),
            new_visit BOOLEAN DEFAULT FALSE,
            follow_up BOOLEAN DEFAULT FALSE,
            
            -- Section 2: Insured Information (Print/Fill in letters or Emboss Card)
            insured_name VARCHAR(255),
            id_card_number VARCHAR(50),
            sex VARCHAR(10) CHECK (sex IN ('Male', 'Female', 'Other', '')),
            age INTEGER,
            policy_holder VARCHAR(255),
            policy_number VARCHAR(50),
            expiry_date DATE,
            class VARCHAR(100),
            
            -- Section 3: Dentist Section (To be completed by the Dentist)
            duration_of_illness_days INTEGER,
            chief_complaints TEXT,
            significant_signs TEXT,
            diagnosis_icd10 VARCHAR(50),
            primary_diagnosis TEXT,
            secondary_diagnosis TEXT,
            other_conditions TEXT,
            
            -- Treatment Type (Please tick where appropriate)
            regular_dental_treatment BOOLEAN DEFAULT FALSE,
            dental_cleaning BOOLEAN DEFAULT FALSE,
            trauma_treatment BOOLEAN DEFAULT FALSE,
            trauma_rta BOOLEAN DEFAULT FALSE,
            work_related BOOLEAN DEFAULT FALSE,
            other_treatment BOOLEAN DEFAULT FALSE,
            treatment_details TEXT,
            treatment_how TEXT,
            treatment_when TEXT,
            treatment_where TEXT,
            
            -- Provider Approval Section
            completed_coded_by VARCHAR(255),
            provider_signature VARCHAR(255),
            provider_date DATE,
            
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    END IF;
END $$;

-- Create dental_procedures table if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'dental_procedures') THEN
        CREATE TABLE dental_procedures (
            id SERIAL PRIMARY KEY,
            form_id INTEGER REFERENCES dental_approvals(id) ON DELETE CASCADE,
            code VARCHAR(50),
            service_description VARCHAR(255),
            tooth_number VARCHAR(50),
            cost DECIMAL(10,2),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    END IF;
END $$;

-- Create dental_medications table if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'dental_medications') THEN
        CREATE TABLE dental_medications (
            id SERIAL PRIMARY KEY,
            form_id INTEGER REFERENCES dental_approvals(id) ON DELETE CASCADE,
            medication_name VARCHAR(255),
            type VARCHAR(100),
            quantity INTEGER,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    END IF;
END $$;

-- Create indexes if they don't exist
CREATE INDEX IF NOT EXISTS idx_dental_approvals_form_number ON dental_approvals(form_number);
CREATE INDEX IF NOT EXISTS idx_dental_approvals_patient_id ON dental_approvals(patient_id);
CREATE INDEX IF NOT EXISTS idx_dental_approvals_provider_id ON dental_approvals(provider_id);
CREATE INDEX IF NOT EXISTS idx_dental_approvals_insurer_id ON dental_approvals(insurer_id);
CREATE INDEX IF NOT EXISTS idx_dental_approvals_status ON dental_approvals(status);
CREATE INDEX IF NOT EXISTS idx_dental_approvals_date_of_visit ON dental_approvals(date_of_visit);
CREATE INDEX IF NOT EXISTS idx_dental_procedures_form_id ON dental_procedures(form_id);
CREATE INDEX IF NOT EXISTS idx_dental_medications_form_id ON dental_medications(form_id);

-- Create or replace trigger for updated_at
DROP TRIGGER IF EXISTS update_dental_approvals_updated_at ON dental_approvals;
CREATE TRIGGER update_dental_approvals_updated_at BEFORE UPDATE ON dental_approvals
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Verify the schema
SELECT 
    'Dental Approvals Migration completed successfully!' as status,
    (SELECT COUNT(*) FROM information_schema.tables WHERE table_name IN ('dental_approvals', 'dental_procedures', 'dental_medications')) as tables_created,
    (SELECT COUNT(*) FROM pg_indexes WHERE tablename IN ('dental_approvals', 'dental_procedures', 'dental_medications')) as indexes_created;

