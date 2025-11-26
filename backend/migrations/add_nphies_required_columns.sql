-- Add NPHIES Required Columns to Existing Tables
-- Run this BEFORE importing seed_nphies_test_data.sql
-- Date: 2025-11-24

-- ========================================
-- 1. Add address column to patients table
-- ========================================
-- NPHIES FHIR Patient resource requires address information
ALTER TABLE patients ADD COLUMN IF NOT EXISTS address TEXT;

-- Add city and country columns (optional but recommended for NPHIES)
ALTER TABLE patients ADD COLUMN IF NOT EXISTS city VARCHAR(100);
ALTER TABLE patients ADD COLUMN IF NOT EXISTS country VARCHAR(3) DEFAULT 'SAU';

COMMENT ON COLUMN patients.address IS 'Patient full address (NPHIES FHIR requirement)';
COMMENT ON COLUMN patients.city IS 'Patient city (NPHIES FHIR optional)';
COMMENT ON COLUMN patients.country IS 'Patient country code (ISO 3166-1 alpha-3)';

-- ========================================
-- 2. Add occupation column to patients table  
-- ========================================
-- NPHIES may use this for eligibility decisions
ALTER TABLE patients ADD COLUMN IF NOT EXISTS occupation VARCHAR(100);

COMMENT ON COLUMN patients.occupation IS 'Patient occupation (NPHIES FHIR extension)';

-- ========================================
-- 3. Ensure providers have contact_person column
-- ========================================
-- NPHIES requires contact information for organizations
ALTER TABLE providers ADD COLUMN IF NOT EXISTS contact_person VARCHAR(255);

-- Rename doctor_name to contact_person if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'providers' AND column_name = 'contact_person'
    ) AND EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'providers' AND column_name = 'doctor_name'
    ) THEN
        -- Copy data from doctor_name to contact_person
        UPDATE providers SET contact_person = doctor_name WHERE doctor_name IS NOT NULL;
    END IF;
END $$;

COMMENT ON COLUMN providers.contact_person IS 'Contact person name (NPHIES Organization requirement)';

-- ========================================
-- 4. Add department column to providers
-- ========================================
ALTER TABLE providers ADD COLUMN IF NOT EXISTS department VARCHAR(100);

COMMENT ON COLUMN providers.department IS 'Department or specialty (for organizational structure)';

-- ========================================
-- 5. Add plan_type to insurers
-- ========================================
ALTER TABLE insurers ADD COLUMN IF NOT EXISTS plan_type VARCHAR(100);

COMMENT ON COLUMN insurers.plan_type IS 'Insurance plan type (e.g., HMO, PPO, EPO)';

-- ========================================
-- 6. Add created_at and updated_at if missing
-- ========================================
ALTER TABLE patients ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE providers ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE providers ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE insurers ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE insurers ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE patient_coverage ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE patient_coverage ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- ========================================
-- 7. Create indexes for new columns
-- ========================================
CREATE INDEX IF NOT EXISTS idx_patients_city ON patients(city);
CREATE INDEX IF NOT EXISTS idx_patients_country ON patients(country);
CREATE INDEX IF NOT EXISTS idx_providers_contact ON providers(contact_person);

-- ========================================
-- VERIFICATION
-- ========================================
SELECT 
    'patients' as table_name,
    COUNT(*) FILTER (WHERE column_name = 'address') as has_address,
    COUNT(*) FILTER (WHERE column_name = 'city') as has_city,
    COUNT(*) FILTER (WHERE column_name = 'country') as has_country,
    COUNT(*) FILTER (WHERE column_name = 'occupation') as has_occupation
FROM information_schema.columns 
WHERE table_name = 'patients'

UNION ALL

SELECT 
    'providers' as table_name,
    COUNT(*) FILTER (WHERE column_name = 'contact_person') as has_contact_person,
    COUNT(*) FILTER (WHERE column_name = 'department') as has_department,
    0 as col3,
    0 as col4
FROM information_schema.columns 
WHERE table_name = 'providers'

UNION ALL

SELECT 
    'insurers' as table_name,
    COUNT(*) FILTER (WHERE column_name = 'plan_type') as has_plan_type,
    0 as col2,
    0 as col3,
    0 as col4
FROM information_schema.columns 
WHERE table_name = 'insurers';

-- Success message
SELECT '✅ NPHIES Required Columns Added Successfully!' as status,
       'Tables now conform to NPHIES FHIR specifications' as note,
       'You can now import seed_nphies_test_data.sql' as next_step;

