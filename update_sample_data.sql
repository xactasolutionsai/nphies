-- =====================================================================
-- SAMPLE DATA UPDATE: Populate Missing Columns with Realistic Data
-- =====================================================================
-- 
-- PURPOSE: Update existing records in patients, providers, and insurers tables
--          with realistic sample data for the newly added columns
--
-- PREREQUISITES:
-- - You must run database_migration_add_missing_columns.sql FIRST
-- - This file will fail if the new columns don't exist
--
-- EXECUTION INSTRUCTIONS:
-- 1. Open pgAdmin and connect to your 'nafes' database
-- 2. Open a new Query Tool (Tools > Query Tool or press F5)
-- 3. Copy and paste this entire file into the Query Tool
-- 4. Click the "Execute" button (play icon) or press F5
-- 5. Check the Messages tab for "Query returned successfully" message
-- 6. Verify the data using the verification queries at the end
--
-- =====================================================================

-- Start transaction for safety
BEGIN;

-- =====================================================================
-- 1. UPDATE PATIENTS TABLE
-- =====================================================================
-- Add email addresses for all 10 existing patients

UPDATE public.patients SET email = 'ahmed.ghamdi@email.com' 
WHERE identifier = '1234567890';

UPDATE public.patients SET email = 'fatima.otaibi@email.com' 
WHERE identifier = '9876543210';

UPDATE public.patients SET email = 'khaled.harbi@email.com' 
WHERE identifier = '1122334455';

UPDATE public.patients SET email = 'sara.ali@email.com' 
WHERE identifier = '2233445566';

UPDATE public.patients SET email = 'omar.bakr@email.com' 
WHERE identifier = '3344556677';

UPDATE public.patients SET email = 'noora.shalan@email.com' 
WHERE identifier = '4455667788';

UPDATE public.patients SET email = 'abdullah.zahrani@email.com' 
WHERE identifier = '5566778899';

UPDATE public.patients SET email = 'lama.turki@email.com' 
WHERE identifier = '6677889900';

UPDATE public.patients SET email = 'majed.tamer@email.com' 
WHERE identifier = '7788990011';

UPDATE public.patients SET email = 'amal.salem@email.com' 
WHERE identifier = '8899001122';

-- =====================================================================
-- 2. UPDATE PROVIDERS TABLE
-- =====================================================================
-- Add email, doctor_name, and department for all 4 existing providers

-- King Faisal Specialist Hospital (NPHIES ID: 90001)
UPDATE public.providers 
SET email = 'referrals@kfsh.med.sa',
    doctor_name = 'Dr. Mohammed Al-Rasheed',
    department = 'Cardiology'
WHERE nphies_id = '90001';

-- Dallah Hospital (NPHIES ID: 90002)
UPDATE public.providers 
SET email = 'admissions@dallah.com.sa',
    doctor_name = 'Dr. Sarah Al-Mansour',
    department = 'Internal Medicine'
WHERE nphies_id = '90002';

-- Al-Mashari Clinic (NPHIES ID: 90003)
UPDATE public.providers 
SET email = 'info@mashari-clinic.com',
    doctor_name = 'Dr. Khalid Al-Mashari',
    department = 'General Practice'
WHERE nphies_id = '90003';

-- Jeddah Medical Center (NPHIES ID: 90004)
UPDATE public.providers 
SET email = 'contact@jmc.com.sa',
    doctor_name = 'Dr. Nora Al-Qahtani',
    department = 'Radiology'
WHERE nphies_id = '90004';

-- =====================================================================
-- 3. UPDATE INSURERS TABLE
-- =====================================================================
-- Add email, address, and plan_type for all 6 existing insurers

-- Bupa Arabia (NPHIES ID: 80001)
UPDATE public.insurers 
SET email = 'customercare@bupa.com.sa',
    address = 'King Fahd Road, Al Olaya District, Riyadh 12333, Saudi Arabia',
    plan_type = 'PPO'
WHERE nphies_id = '80001';

-- Tawuniya (NPHIES ID: 80002)
UPDATE public.insurers 
SET email = 'info@tawuniya.com.sa',
    address = 'Tawuniya Towers, King Fahd Road, Riyadh 11372, Saudi Arabia',
    plan_type = 'HMO'
WHERE nphies_id = '80002';

-- MedGulf (NPHIES ID: 80003)
UPDATE public.insurers 
SET email = 'claims@medgulf.com.sa',
    address = 'Al Maather Street, Al Khobar 31952, Eastern Province, Saudi Arabia',
    plan_type = 'PPO'
WHERE nphies_id = '80003';

-- AXA Cooperative (NPHIES ID: 80004)
UPDATE public.insurers 
SET email = 'support@axa-gulf.com',
    address = 'Prince Sultan Street, Jeddah 23442, Saudi Arabia',
    plan_type = 'Comprehensive'
WHERE nphies_id = '80004';

-- Walaa Cooperative (NPHIES ID: 80005)
UPDATE public.insurers 
SET email = 'service@walaa.com',
    address = 'King Abdul Aziz Road, Riyadh 11564, Saudi Arabia',
    plan_type = 'HMO'
WHERE nphies_id = '80005';

-- Saudi Health Alliance (NPHIES ID: 80006)
UPDATE public.insurers 
SET email = 'contact@sha.com.sa',
    address = 'Business District, Dammam 32413, Eastern Province, Saudi Arabia',
    plan_type = 'TPA'
WHERE nphies_id = '80006';

-- Commit the transaction
COMMIT;

-- =====================================================================
-- VERIFICATION QUERIES
-- =====================================================================
-- Run these queries to verify the data was updated successfully:

-- Verify patients data
SELECT name, identifier, phone, email 
FROM public.patients 
ORDER BY name
LIMIT 10;

-- Verify providers data
SELECT provider_name, nphies_id, doctor_name, department, phone, email 
FROM public.providers 
ORDER BY provider_name;

-- Verify insurers data
SELECT insurer_name, nphies_id, plan_type, contact_person, phone, email, address 
FROM public.insurers 
ORDER BY insurer_name;

-- Count records with populated new fields
SELECT 
    'Patients with email' as description,
    COUNT(*) as count 
FROM public.patients 
WHERE email IS NOT NULL
UNION ALL
SELECT 
    'Providers with email',
    COUNT(*) 
FROM public.providers 
WHERE email IS NOT NULL
UNION ALL
SELECT 
    'Providers with doctor_name',
    COUNT(*) 
FROM public.providers 
WHERE doctor_name IS NOT NULL
UNION ALL
SELECT 
    'Providers with department',
    COUNT(*) 
FROM public.providers 
WHERE department IS NOT NULL
UNION ALL
SELECT 
    'Insurers with email',
    COUNT(*) 
FROM public.insurers 
WHERE email IS NOT NULL
UNION ALL
SELECT 
    'Insurers with address',
    COUNT(*) 
FROM public.insurers 
WHERE address IS NOT NULL
UNION ALL
SELECT 
    'Insurers with plan_type',
    COUNT(*) 
FROM public.insurers 
WHERE plan_type IS NOT NULL;

-- =====================================================================
-- SUCCESS MESSAGE
-- =====================================================================
-- Expected results:
-- - 10 Patients with email
-- - 4 Providers with email
-- - 4 Providers with doctor_name
-- - 4 Providers with department
-- - 6 Insurers with email
-- - 6 Insurers with address
-- - 6 Insurers with plan_type
--
-- If you see these counts, the data update was successful!
-- Your frontend forms should now populate correctly when fetching data.
-- =====================================================================

