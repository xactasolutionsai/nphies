-- =====================================================================
-- DATABASE MIGRATION: Add Missing Columns for Form Field Support
-- =====================================================================
-- 
-- PURPOSE: Add missing columns to patients, providers, and insurers tables
--          to support all form fields in the frontend application
--
-- EXECUTION INSTRUCTIONS:
-- 1. Open pgAdmin and connect to your 'nafes' database
-- 2. Open a new Query Tool (Tools > Query Tool or press F5)
-- 3. Copy and paste this entire file into the Query Tool
-- 4. Click the "Execute" button (play icon) or press F5
-- 5. Check the Messages tab for "Query returned successfully" message
-- 6. After successful execution, run the update_sample_data.sql file
--
-- ROLLBACK (if needed):
-- If you need to undo these changes, run:
-- ALTER TABLE public.patients DROP COLUMN IF EXISTS email;
-- ALTER TABLE public.providers DROP COLUMN IF EXISTS email, DROP COLUMN IF EXISTS doctor_name, DROP COLUMN IF EXISTS department;
-- ALTER TABLE public.insurers DROP COLUMN IF EXISTS email, DROP COLUMN IF EXISTS address, DROP COLUMN IF EXISTS plan_type;
--
-- =====================================================================

-- Start transaction for safety
BEGIN;

-- =====================================================================
-- 1. ALTER PATIENTS TABLE
-- =====================================================================
-- Add email column to store patient email addresses
ALTER TABLE public.patients 
ADD COLUMN IF NOT EXISTS email VARCHAR(255);

-- Add comment for documentation
COMMENT ON COLUMN public.patients.email IS 'Patient email address for contact purposes';

-- =====================================================================
-- 2. ALTER PROVIDERS TABLE
-- =====================================================================
-- Add email column for provider facility contact
ALTER TABLE public.providers 
ADD COLUMN IF NOT EXISTS email VARCHAR(255);

-- Add doctor_name column to store the name of the treating physician
ALTER TABLE public.providers 
ADD COLUMN IF NOT EXISTS doctor_name VARCHAR(255);

-- Add department column to specify the department within the facility
ALTER TABLE public.providers 
ADD COLUMN IF NOT EXISTS department VARCHAR(255);

-- Add comments for documentation
COMMENT ON COLUMN public.providers.email IS 'Provider facility email address';
COMMENT ON COLUMN public.providers.doctor_name IS 'Name of the treating doctor at the facility';
COMMENT ON COLUMN public.providers.department IS 'Department within the facility (e.g., Radiology, Cardiology)';

-- =====================================================================
-- 3. ALTER INSURERS TABLE
-- =====================================================================
-- Add email column for insurer contact
ALTER TABLE public.insurers 
ADD COLUMN IF NOT EXISTS email VARCHAR(255);

-- Add address column for insurer physical address
ALTER TABLE public.insurers 
ADD COLUMN IF NOT EXISTS address TEXT;

-- Add plan_type column to categorize insurance plan types
ALTER TABLE public.insurers 
ADD COLUMN IF NOT EXISTS plan_type VARCHAR(100);

-- Add comments for documentation
COMMENT ON COLUMN public.insurers.email IS 'Insurer company email address';
COMMENT ON COLUMN public.insurers.address IS 'Insurer company physical address';
COMMENT ON COLUMN public.insurers.plan_type IS 'Type of insurance plan (e.g., PPO, HMO, TPA, Government)';

-- Commit the transaction
COMMIT;

-- =====================================================================
-- VERIFICATION QUERIES
-- =====================================================================
-- Run these queries to verify the columns were added successfully:

-- Check patients table structure
SELECT column_name, data_type, character_maximum_length 
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'patients' 
  AND column_name IN ('email')
ORDER BY ordinal_position;

-- Check providers table structure
SELECT column_name, data_type, character_maximum_length 
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'providers' 
  AND column_name IN ('email', 'doctor_name', 'department')
ORDER BY ordinal_position;

-- Check insurers table structure
SELECT column_name, data_type, character_maximum_length 
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'insurers' 
  AND column_name IN ('email', 'address', 'plan_type')
ORDER BY ordinal_position;

-- =====================================================================
-- SUCCESS MESSAGE
-- =====================================================================
-- If you see results in the verification queries above, the migration
-- was successful. You can now proceed to run update_sample_data.sql
-- =====================================================================

