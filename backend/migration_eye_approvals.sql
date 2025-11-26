-- Migration script for Eye Approvals tables
-- This script creates tables for the Eye/Optical Approvals and Claims Application module
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

-- Create eye_approvals table if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'eye_approvals') THEN
        -- Create the main eye approvals table
        CREATE TABLE eye_approvals (
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
            approval VARCHAR(100),
            
            -- Section 3: Optician Section (To be completed by the Optician)
            duration_of_illness_days INTEGER,
            chief_complaints TEXT,
            significant_signs TEXT,
            
            -- Right Eye Specifications (stored as JSONB for flexibility)
            -- Structure: { distance: { sphere, cylinder, axis, prism, vn }, near: { sphere, cylinder, axis, prism, vn }, bifocal_add: value, vertex_add: value }
            right_eye_specs JSONB DEFAULT '{}',
            
            -- Left Eye Specifications (stored as JSONB for flexibility)
            -- Structure: { distance: { sphere, cylinder, axis, prism, vn, pd }, near: { sphere, cylinder, axis, prism, vn }, bifocal_add: value }
            left_eye_specs JSONB DEFAULT '{}',
            
            -- Regular Lenses Type
            lens_type VARCHAR(50), -- 'glass', 'plastic', 'none'
            
            -- Lenses Specification (stored as JSONB for all checkbox options)
            -- Structure: { multi_coated, varilux, light, aspheric, bifocal, medium, lenticular, single_vision, dark, safety_thickness, anti_reflecting, photosensitive, high_index, colored, anti_scratch }
            lens_specifications JSONB DEFAULT '{}',
            
            -- Contact Lenses Type
            contact_lenses_permanent BOOLEAN DEFAULT FALSE,
            contact_lenses_disposal BOOLEAN DEFAULT FALSE,
            
            -- Frames
            frames_required BOOLEAN DEFAULT FALSE,
            number_of_pairs INTEGER,
            
            -- Provider Approval Section
            completed_coded_by VARCHAR(255),
            provider_signature VARCHAR(255),
            provider_date DATE,
            
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    END IF;
END $$;

-- Create eye_procedures table if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'eye_procedures') THEN
        CREATE TABLE eye_procedures (
            id SERIAL PRIMARY KEY,
            form_id INTEGER REFERENCES eye_approvals(id) ON DELETE CASCADE,
            code VARCHAR(50),
            service_description VARCHAR(255),
            type VARCHAR(100),
            cost DECIMAL(10,2),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    END IF;
END $$;

-- Create indexes if they don't exist
CREATE INDEX IF NOT EXISTS idx_eye_approvals_form_number ON eye_approvals(form_number);
CREATE INDEX IF NOT EXISTS idx_eye_approvals_patient_id ON eye_approvals(patient_id);
CREATE INDEX IF NOT EXISTS idx_eye_approvals_provider_id ON eye_approvals(provider_id);
CREATE INDEX IF NOT EXISTS idx_eye_approvals_insurer_id ON eye_approvals(insurer_id);
CREATE INDEX IF NOT EXISTS idx_eye_approvals_status ON eye_approvals(status);
CREATE INDEX IF NOT EXISTS idx_eye_approvals_date_of_visit ON eye_approvals(date_of_visit);
CREATE INDEX IF NOT EXISTS idx_eye_procedures_form_id ON eye_procedures(form_id);

-- Create or replace trigger for updated_at
DROP TRIGGER IF EXISTS update_eye_approvals_updated_at ON eye_approvals;
CREATE TRIGGER update_eye_approvals_updated_at BEFORE UPDATE ON eye_approvals
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Verify the schema
SELECT 
    'Eye Approvals Migration completed successfully!' as status,
    (SELECT COUNT(*) FROM information_schema.tables WHERE table_name IN ('eye_approvals', 'eye_procedures')) as tables_created,
    (SELECT COUNT(*) FROM pg_indexes WHERE tablename IN ('eye_approvals', 'eye_procedures')) as indexes_created;

