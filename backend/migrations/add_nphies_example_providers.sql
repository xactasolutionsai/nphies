-- Migration: Add Official NPHIES Example Providers
-- Source: https://portal.nphies.sa/ig/artifacts.html
-- These are the test providers from NPHIES documentation

-- First, let's see what providers we have
-- SELECT provider_id, provider_name, nphies_id, provider_type, location_license FROM providers;

-- Insert official NPHIES example providers (or update if nphies_id exists)
-- Provider 1: Saudi General Hospital (Main test hospital)
INSERT INTO providers (provider_name, nphies_id, provider_type, location_license, address)
VALUES (
    'Saudi General Hospital',
    'PR-FHIR',
    '1',  -- Hospital
    'GACH',
    'Salamah Street, Building 25, Suite 2, Riyadh Saudi Arabia'
)
ON CONFLICT (nphies_id) DO UPDATE SET
    provider_name = EXCLUDED.provider_name,
    provider_type = EXCLUDED.provider_type,
    location_license = EXCLUDED.location_license,
    address = EXCLUDED.address,
    updated_at = NOW();

-- Provider 2: Saudi Dental Clinic
INSERT INTO providers (provider_name, nphies_id, provider_type, location_license, address)
VALUES (
    'Saudi Dental Clinic',
    'DC-FHIR',
    '5',  -- Clinic
    'GACH',
    'Hajar Valley, Building 104, Riyadh Saudi Arabia'
)
ON CONFLICT (nphies_id) DO UPDATE SET
    provider_name = EXCLUDED.provider_name,
    provider_type = EXCLUDED.provider_type,
    location_license = EXCLUDED.location_license,
    address = EXCLUDED.address,
    updated_at = NOW();

-- Provider 3: Saudi Vision Care
INSERT INTO providers (provider_name, nphies_id, provider_type, location_license, address)
VALUES (
    'Saudi Vision Care',
    'VC-FHIR',
    '5',  -- Clinic
    'GACH',
    'Olaya Street, Building 442 Suite 102, Riyadh Saudi Arabia'
)
ON CONFLICT (nphies_id) DO UPDATE SET
    provider_name = EXCLUDED.provider_name,
    provider_type = EXCLUDED.provider_type,
    location_license = EXCLUDED.location_license,
    address = EXCLUDED.address,
    updated_at = NOW();

-- Provider 4: Saudi Professional Clinic
INSERT INTO providers (provider_name, nphies_id, provider_type, location_license, address)
VALUES (
    'Saudi Professional Clinic',
    'PC-FHIR',
    '5',  -- Clinic
    'GACH',
    'Olaya Street, Building 987 Suite 500, Riyadh Saudi Arabia'
)
ON CONFLICT (nphies_id) DO UPDATE SET
    provider_name = EXCLUDED.provider_name,
    provider_type = EXCLUDED.provider_type,
    location_license = EXCLUDED.location_license,
    address = EXCLUDED.address,
    updated_at = NOW();

-- Provider 5: Saudi Pharmacy
INSERT INTO providers (provider_name, nphies_id, provider_type, location_license, address)
VALUES (
    'Saudi Pharmacy',
    'PH-FHIR',
    '3',  -- Pharmacy
    'GACH',
    'Amir Street, Building 14, Riyadh Saudi Arabia'
)
ON CONFLICT (nphies_id) DO UPDATE SET
    provider_name = EXCLUDED.provider_name,
    provider_type = EXCLUDED.provider_type,
    location_license = EXCLUDED.location_license,
    address = EXCLUDED.address,
    updated_at = NOW();

-- Verify the inserted/updated providers
SELECT provider_id, provider_name, nphies_id, provider_type, location_license, address
FROM providers 
WHERE nphies_id IN ('PR-FHIR', 'DC-FHIR', 'VC-FHIR', 'PC-FHIR', 'PH-FHIR')
ORDER BY provider_name;

-- Summary of NPHIES Provider Type Codes:
-- Code | Display      | Description
-- -----+--------------+----------------------------------
--  1   | Hospital     | General hospitals, specialist hospitals
--  2   | Polyclinic   | Multi-specialty clinics
--  3   | Pharmacy     | Pharmacies
--  4   | Optical Shop | Vision/optical stores
--  5   | Clinic       | Single specialty clinics (dental, vision, professional, etc.)

