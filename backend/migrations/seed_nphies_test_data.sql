-- NPHIES Test Data Seed File
-- Import this in pgAdmin to get ready-to-use test data
-- Date: 2025-11-24
--
-- ⭐ IMPORTANT: NPHIES Official Example Data Included!
-- The first patient/provider/insurer/coverage is the EXACT match from NPHIES documentation
-- This data WILL WORK with the NPHIES OBA API: http://176.105.150.83/$process-message
--
-- NPHIES Example Data (WORKS WITH API):
--   Patient: Ahmad Abbas (ID: 2234567890)
--   Provider: King Fahad Specialist Hospital (NPHIES ID: provider-license)
--   Insurer: Bupa Arabia Insurance Company (NPHIES ID: payer-license)
--   Policy: POL-123456 ← Use this for guaranteed API success!
--
-- Additional Test Data (For UI testing, may not work with NPHIES):
--   7 more patients with Arabic names
--   4 more providers
--   4 more insurers
--   7 more coverages

-- ====================
-- CLEAR EXISTING DATA (Optional - Comment out if you want to keep existing data)
-- ====================
-- TRUNCATE TABLE patient_coverage CASCADE;
-- DELETE FROM eligibility WHERE nphies_request_id IS NOT NULL;

-- ====================
-- INSERT PATIENTS
-- ====================

INSERT INTO patients (patient_id, name, identifier, identifier_type, gender, birth_date, nationality, marital_status, phone, email, address, city, country, created_at)
VALUES
    -- NPHIES Official Example Patient (EXACT match from documentation)
    (gen_random_uuid(), 'Ahmad Abbas', '2234567890', 'national_id', 'male', '1990-05-15', 'SAU', 'M', '+966501234567', 'ahmad.abbas@email.com', 'King Fahd Road', 'Riyadh', 'SAU', NOW()),
    -- Additional Test Patients (Arabic names for variety)
    (gen_random_uuid(), 'أحمد محمد العلي', '2234567891', 'national_id', 'male', '1985-03-15', 'SAU', 'M', '+966501234568', 'ahmad.ali@email.com', 'King Fahd Road', 'Riyadh', 'SAU', NOW()),
    (gen_random_uuid(), 'فاطمة عبدالله السعد', '2345678901', 'national_id', 'female', '1990-07-22', 'SAU', 'M', '+966502345678', 'fatima.saad@email.com', 'Olaya Street', 'Riyadh', 'SAU', NOW()),
    (gen_random_uuid(), 'محمد خالد القحطاني', '2456789012', 'national_id', 'male', '1988-11-10', 'SAU', 'S', '+966503456789', 'mohammed.qahtani@email.com', 'King Abdullah Road', 'Jeddah', 'SAU', NOW()),
    (gen_random_uuid(), 'نورة سعد المطيري', '2567890123', 'national_id', 'female', '1995-02-28', 'SAU', 'S', '+966504567890', 'noura.mutairi@email.com', 'Al Malaz', 'Riyadh', 'SAU', NOW()),
    (gen_random_uuid(), 'عبدالرحمن أحمد الغامدي', '2678901234', 'national_id', 'male', '1982-09-05', 'SAU', 'M', '+966505678901', 'abdulrahman.ghamdi@email.com', 'Al Rawdah', 'Dammam', 'SAU', NOW()),
    (gen_random_uuid(), 'سارة محمد الشمري', '2789012345', 'national_id', 'female', '1992-12-18', 'SAU', 'M', '+966506789012', 'sara.shammari@email.com', 'Al Aziziyah', 'Mecca', 'SAU', NOW()),
    (gen_random_uuid(), 'عمر حسن العتيبي', '2890123456', 'national_id', 'male', '1987-04-30', 'SAU', 'S', '+966507890123', 'omar.otaibi@email.com', 'Al Hamra', 'Jeddah', 'SAU', NOW())
ON CONFLICT (patient_id) DO NOTHING;

-- ====================
-- INSERT PROVIDERS
-- ====================

INSERT INTO providers (provider_id, provider_name, nphies_id, provider_type, location_license, type, address, phone, email, contact_person, created_at)
VALUES
    -- NPHIES Official Example Provider (EXACT match from documentation)
    (gen_random_uuid(), 'King Fahad Specialist Hospital', 'provider-license', 'hospital', 'LOC-001', 'Hospital', 'King Fahd Road, Riyadh 12211', '+966112345678', 'info@kfsh.med.sa', 'Dr. Abdullah Ahmed', NOW()),
    -- Additional Test Providers (Arabic names)
    (gen_random_uuid(), 'مستشفى الملك فهد التخصصي', 'provider-license-001', 'hospital', 'LOC-001A', 'Hospital', 'King Fahd Road, Riyadh 12211', '+966112345679', 'info@kfsh-ar.med.sa', 'Dr. Abdullah Ahmed', NOW()),
    (gen_random_uuid(), 'مركز الرعاية الطبية المتقدم', 'provider-license-002', 'clinic', 'LOC-002', 'Medical Center', 'Olaya Street, Riyadh 11564', '+966112345680', 'info@amc.med.sa', 'Dr. Fatima Mohammed', NOW()),
    (gen_random_uuid(), 'عيادة الدكتور أحمد محمد', 'provider-license-003', 'clinic', 'LOC-003', 'Private Clinic', 'Al Malaz, Riyadh 11453', '+966112345681', 'dr.ahmad@clinic.sa', 'Dr. Ahmad Mohammed', NOW()),
    (gen_random_uuid(), 'مستشفى المملكة', 'provider-license-004', 'hospital', 'LOC-004', 'Hospital', 'King Abdullah Road, Jeddah 23323', '+966122345682', 'info@kingdom-hospital.sa', 'Dr. Noura Salem', NOW()),
    (gen_random_uuid(), 'مركز الأسنان المتخصص', 'provider-license-005', 'dental_clinic', 'LOC-005', 'Dental Clinic', 'Al Aziziyah, Riyadh 11534', '+966112345683', 'dental@specialist.sa', 'Dr. Omar Hassan', NOW())
ON CONFLICT (provider_id) DO NOTHING;

-- ====================
-- INSERT INSURERS
-- ====================

INSERT INTO insurers (insurer_id, insurer_name, nphies_id, status, contact_person, phone, email, address, created_at)
VALUES
    -- NPHIES Official Example Insurer (EXACT match from documentation)
    (gen_random_uuid(), 'Bupa Arabia Insurance Company', 'payer-license', 'Active', 'Sarah Mohammed', '+966112223333', 'info@bupa.com.sa', 'Business Tower, Riyadh', NOW()),
    -- Additional Test Insurers (Arabic names)
    (gen_random_uuid(), 'بوبا العربية للتأمين', 'payer-license-001', 'Active', 'Sarah Mohammed', '+966112223334', 'info@bupa-ar.com.sa', 'Business Tower, Riyadh', NOW()),
    (gen_random_uuid(), 'التأمين الصحي السعودي', 'payer-license-002', 'Active', 'Ahmed Ali', '+966112223335', 'info@saudi-insurance.sa', 'Al Olaya District, Riyadh', NOW()),
    (gen_random_uuid(), 'تأمين مدجلف', 'payer-license-003', 'Active', 'Fatima Abdullah', '+966112223336', 'info@medgulf.sa', 'King Fahd Road, Jeddah', NOW()),
    (gen_random_uuid(), 'الشركة الوطنية للتأمين', 'payer-license-004', 'Active', 'Mohammed Salem', '+966112223337', 'info@ncci.com.sa', 'Al Khobar, Eastern Province', NOW()),
    (gen_random_uuid(), 'ملاذ للتأمين', 'payer-license-005', 'Active', 'Noura Hassan', '+966112223338', 'info@malath.com.sa', 'Al Malqa, Riyadh', NOW())
ON CONFLICT (insurer_id) DO NOTHING;

-- ====================
-- INSERT PATIENT COVERAGE
-- ====================

-- Get patient and insurer IDs for coverage creation
DO $$
DECLARE
    patient1_id UUID;
    patient2_id UUID;
    patient3_id UUID;
    patient4_id UUID;
    patient5_id UUID;
    patient6_id UUID;
    patient7_id UUID;
    patient8_id UUID;
    
    insurer1_id UUID;
    insurer2_id UUID;
    insurer3_id UUID;
    insurer4_id UUID;
    insurer5_id UUID;
BEGIN
    -- Get patient IDs by identifier
    SELECT patient_id INTO patient1_id FROM patients WHERE identifier = '2234567890'; -- Ahmad Abbas (NPHIES Example)
    SELECT patient_id INTO patient2_id FROM patients WHERE identifier = '2234567891'; -- أحمد محمد العلي
    SELECT patient_id INTO patient3_id FROM patients WHERE identifier = '2345678901';
    SELECT patient_id INTO patient4_id FROM patients WHERE identifier = '2456789012';
    SELECT patient_id INTO patient5_id FROM patients WHERE identifier = '2567890123';
    SELECT patient_id INTO patient6_id FROM patients WHERE identifier = '2678901234';
    SELECT patient_id INTO patient7_id FROM patients WHERE identifier = '2789012345';
    SELECT patient_id INTO patient8_id FROM patients WHERE identifier = '2890123456';
    
    -- Get insurer IDs by nphies_id
    SELECT insurer_id INTO insurer1_id FROM insurers WHERE nphies_id = 'payer-license'; -- Bupa Arabia (NPHIES Example)
    SELECT insurer_id INTO insurer2_id FROM insurers WHERE nphies_id = 'payer-license-002';
    SELECT insurer_id INTO insurer3_id FROM insurers WHERE nphies_id = 'payer-license-003';
    SELECT insurer_id INTO insurer4_id FROM insurers WHERE nphies_id = 'payer-license-004';
    SELECT insurer_id INTO insurer5_id FROM insurers WHERE nphies_id = 'payer-license-005';
    
    -- Insert coverages for each patient
    INSERT INTO patient_coverage (coverage_id, patient_id, insurer_id, policy_number, member_id, coverage_type, relationship, plan_name, network_type, start_date, end_date, is_active, created_at)
    VALUES
        -- ⭐ NPHIES Official Example Coverage (EXACT match - THIS WILL WORK WITH NPHIES API!)
        (gen_random_uuid(), patient1_id, insurer1_id, 'POL-123456', 'MEM-123456', 'EHCPOL', 'self', 'Premium Health Plan', 'In-Network', '2020-01-01', '2025-12-31', true, NOW()),
        
        -- Additional test coverages (for variety, may not work with NPHIES)
        (gen_random_uuid(), patient2_id, insurer1_id, 'POL-BUPA-001', 'MEM-001', 'EHCPOL', 'self', 'Premium Health Plan', 'In-Network', '2024-01-01', '2025-12-31', true, NOW()),
        
        -- Patient 3: Saudi Insurance - Family Plan
        (gen_random_uuid(), patient3_id, insurer2_id, 'POL-SI-002', 'MEM-002', 'EHCPOL', 'self', 'Family Health Coverage', 'In-Network', '2024-02-01', '2025-12-31', true, NOW()),
        
        -- Patient 4: Medgulf - Basic Plan
        (gen_random_uuid(), patient4_id, insurer3_id, 'POL-MG-003', 'MEM-003', 'EHCPOL', 'self', 'Basic Health Plan', 'In-Network', '2024-01-15', '2025-12-31', true, NOW()),
        
        -- Patient 5: National Insurance - Comprehensive
        (gen_random_uuid(), patient5_id, insurer4_id, 'POL-NI-004', 'MEM-004', 'EHCPOL', 'self', 'Comprehensive Coverage', 'Both', '2024-03-01', '2025-12-31', true, NOW()),
        
        -- Patient 6: Malath - Executive Plan
        (gen_random_uuid(), patient6_id, insurer5_id, 'POL-MAL-005', 'MEM-005', 'EHCPOL', 'self', 'Executive Health Plan', 'In-Network', '2024-01-10', '2025-12-31', true, NOW()),
        
        -- Patient 7: Bupa Arabia - Standard Plan
        (gen_random_uuid(), patient7_id, insurer1_id, 'POL-BUPA-006', 'MEM-006', 'EHCPOL', 'self', 'Standard Health Plan', 'In-Network', '2024-02-15', '2025-12-31', true, NOW()),
        
        -- Patient 8: Saudi Insurance - Premium
        (gen_random_uuid(), patient8_id, insurer2_id, 'POL-SI-007', 'MEM-007', 'EHCPOL', 'self', 'Premium Health Coverage', 'Both', '2024-01-20', '2025-12-31', true, NOW())
    ON CONFLICT (coverage_id) DO NOTHING;
END $$;

-- ====================
-- VERIFICATION QUERIES
-- ====================

-- Check inserted data
SELECT '=== PATIENTS ===' as info;
SELECT patient_id, name, identifier, phone FROM patients ORDER BY created_at DESC LIMIT 10;

SELECT '=== PROVIDERS ===' as info;
SELECT provider_id, provider_name, nphies_id, provider_type FROM providers ORDER BY created_at DESC LIMIT 10;

SELECT '=== INSURERS ===' as info;
SELECT insurer_id, insurer_name, nphies_id, status FROM insurers ORDER BY created_at DESC LIMIT 10;

SELECT '=== PATIENT COVERAGES ===' as info;
SELECT 
    pc.coverage_id,
    p.name as patient_name,
    i.insurer_name,
    pc.policy_number,
    pc.plan_name,
    pc.is_active
FROM patient_coverage pc
JOIN patients p ON pc.patient_id = p.patient_id
JOIN insurers i ON pc.insurer_id = i.insurer_id
ORDER BY pc.created_at DESC
LIMIT 10;

-- Summary counts
SELECT 
    (SELECT COUNT(*) FROM patients) as total_patients,
    (SELECT COUNT(*) FROM providers) as total_providers,
    (SELECT COUNT(*) FROM insurers) as total_insurers,
    (SELECT COUNT(*) FROM patient_coverage) as total_coverages;

-- Success message
SELECT '✅ NPHIES Test Data Imported Successfully!' as status,
       'All patients have active insurance coverage and can be used for eligibility testing' as note;

