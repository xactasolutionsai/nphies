-- =====================================================
-- NPHIES Code System Tables Migration
-- Run this in pgAdmin to create code lookup tables
-- Reference: https://portal.nphies.sa/ig/
-- =====================================================

-- Enable UUID extension if not exists
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- 1. Create Code Systems Master Table
-- =====================================================
CREATE TABLE IF NOT EXISTS nphies_code_systems (
    code_system_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(100) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    source_url VARCHAR(500),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- =====================================================
-- 2. Create Codes Table
-- =====================================================
CREATE TABLE IF NOT EXISTS nphies_codes (
    nphies_code_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code_system_id UUID REFERENCES nphies_code_systems(code_system_id) ON DELETE CASCADE,
    code VARCHAR(50) NOT NULL,
    display_en VARCHAR(255) NOT NULL,
    display_ar VARCHAR(255),
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    sort_order INTEGER,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(code_system_id, code)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_nphies_codes_system ON nphies_codes(code_system_id);
CREATE INDEX IF NOT EXISTS idx_nphies_codes_code ON nphies_codes(code);

-- =====================================================
-- 3. Insert Code Systems
-- =====================================================
INSERT INTO nphies_code_systems (code, name, description, source_url) VALUES
('benefit-category', 'Benefit Category', 'Categories of benefits for eligibility and claims', 'https://portal.nphies.sa/ig/ValueSet-benefit-category.html'),
('coverage-type', 'Coverage Type', 'Types of insurance coverage', 'https://portal.nphies.sa/ig/CodeSystem-coverage-type.html'),
('coverage-copay-type', 'Coverage Copay Type', 'Types of cost to beneficiary', 'https://portal.nphies.sa/ig/CodeSystem-coverage-copay-type.html'),
('benefit-type', 'Benefit Type', 'Types of benefits in eligibility response', 'https://portal.nphies.sa/ig/CodeSystem-benefit-type.html'),
('site-eligibility', 'Site Eligibility', 'Site eligibility status codes', 'https://portal.nphies.sa/ig/CodeSystem-siteEligibility.html'),
('identifier-type', 'Identifier Type', 'Patient identifier types', 'https://portal.nphies.sa/ig/ValueSet-patient-identifier-type.html'),
('provider-type', 'Provider Type', 'Healthcare provider types', 'https://portal.nphies.sa/ig/CodeSystem-provider-type.html'),
('marital-status', 'Marital Status', 'Patient marital status codes', 'http://terminology.hl7.org/CodeSystem/v3-MaritalStatus'),
('subscriber-relationship', 'Subscriber Relationship', 'Relationship to subscriber', 'http://terminology.hl7.org/CodeSystem/subscriber-relationship'),
('benefit-network', 'Benefit Network', 'In/Out of network indicator', 'http://terminology.hl7.org/CodeSystem/benefit-network'),
('benefit-term', 'Benefit Term', 'Benefit period terms', 'http://terminology.hl7.org/CodeSystem/benefit-term'),
('benefit-unit', 'Benefit Unit', 'Benefit unit types', 'http://terminology.hl7.org/CodeSystem/benefit-unit'),
('organization-type', 'Organization Type', 'Types of organizations', 'https://portal.nphies.sa/ig/CodeSystem-organization-type.html'),
('occupation', 'Occupation', 'Patient occupation codes', 'https://portal.nphies.sa/ig/CodeSystem-occupation.html'),
('ksa-administrative-gender', 'KSA Administrative Gender', 'Saudi administrative gender codes', 'https://portal.nphies.sa/ig/CodeSystem-ksa-administrative-gender.html')
ON CONFLICT (code) DO NOTHING;

-- =====================================================
-- 4. Insert Benefit Categories (84 codes)
-- Reference: https://portal.nphies.sa/ig/ValueSet-benefit-category.html
-- =====================================================
INSERT INTO nphies_codes (code_system_id, code, display_en, sort_order)
SELECT cs.code_system_id, v.code, v.display_en, v.sort_order
FROM nphies_code_systems cs
CROSS JOIN (VALUES
    ('1', 'Medical Care', 1),
    ('2', 'Surgical', 2),
    ('3', 'Consultation', 3),
    ('4', 'Diagnostic XRay', 4),
    ('5', 'Diagnostic Lab', 5),
    ('6', 'Renal Supplies', 6),
    ('7', 'Diagnostic Dental', 7),
    ('8', 'Periodontics', 8),
    ('9', 'Restorative', 9),
    ('10', 'Endodontics', 10),
    ('11', 'Maxillofacial Prosthetics', 11),
    ('12', 'Adjunctive Dental Services', 12),
    ('13', 'Health Benefit Plan Coverage', 13),
    ('14', 'Dental Care', 14),
    ('15', 'Dental Crowns', 15),
    ('16', 'Dental Accident', 16),
    ('17', 'Hospital Room and Board', 17),
    ('18', 'Major Medical', 18),
    ('19', 'Medically Related Transportation', 19),
    ('20', 'In-vitro Fertilization', 20),
    ('21', 'MRI Scan', 21),
    ('22', 'Donor Procedures', 22),
    ('23', 'Maternity', 23),
    ('24', 'Renal Dialysis', 24),
    ('25', 'Medical Coverage', 25),
    ('26', 'Dental Coverage', 26),
    ('27', 'Hearing Coverage', 27),
    ('28', 'Vision Coverage', 28),
    ('29', 'Mental Health', 29),
    ('30', 'OP Medical', 30),
    ('31', 'Max Copay', 31),
    ('32', 'Medical Equipment', 32),
    ('33', 'Acute Psychiatric Cases', 33),
    ('34', 'Non-acute Psychological Disorders', 34),
    ('35', 'Prescription Drugs', 35),
    ('36', 'Cancer Treatment', 36),
    ('37', 'Orthodontic Treatment', 37),
    ('38', 'Check ups', 38),
    ('39', 'Circumcision of male newborn', 39),
    ('40', 'Ear Piercing of female newborn', 40),
    ('41', 'Vaccination services for children', 41),
    ('42', 'Pre-existing and chronic diseases', 42),
    ('43', 'Outpatient Treatment - within network', 43),
    ('44', 'Outpatient Treatment - out of network (Hospitals)', 44),
    ('45', 'Outpatient Treatment - out of network (Others)', 45),
    ('46', 'Daily room and board', 46),
    ('47', 'Hospital sitter room and board', 47),
    ('48', 'Cosmetic Treatment', 48),
    ('49', 'Physiotherapy', 49),
    ('50', 'Prosthetic Devices', 50),
    ('51', 'Obesity Surgery', 51),
    ('52', 'Ambulance', 52),
    ('53', 'Home Healthcare', 53),
    ('54', 'Corpse Repatriation', 54),
    ('55', 'Rare Specialities Consultation', 55),
    ('56', 'Consultant Consultation', 56),
    ('57', 'OP Prescribed Invented Medicines - with generic alternative', 57),
    ('58', 'Advanced Dental Coverage', 58),
    ('59', 'Advanced Homecare coverage', 59),
    ('60', 'Advanced Obesity Medical Management', 60),
    ('61', 'Basic and Preventive Dental Coverage', 61),
    ('62', 'Basic Homecare coverage', 62),
    ('63', 'Contraception Coverage (Birth Control)', 63),
    ('64', 'Hip and Knee Replacement', 64),
    ('65', 'Impairment medical management', 65),
    ('66', 'OP Prescribed Generic and Invented Medicines - no generic available', 66),
    ('67', 'Outpatient Treatment - Primary clinic', 67),
    ('68', 'Outpatient Treatment - specialized clinic with referral', 68),
    ('69', 'Outpatient Treatment - specialized clinic without referral', 69),
    ('70', 'Pediatric vision coverage', 70),
    ('71', 'Psychiatry coverage', 71),
    ('72', 'Renal transplant', 72),
    ('73', 'Root canal dental coverage', 73),
    ('74', 'Complications from treatment of covered benefit', 74),
    ('75', 'Congenital anomalies', 75),
    ('76', 'Early examination of newborn program', 76),
    ('77', 'Delivery of premature babies', 77),
    ('78', 'Emergency Service coverage', 78),
    ('79', 'Genetic diseases', 79),
    ('80', 'Inpatient Medical Coverage', 80),
    ('81', 'Life sustaining and interventions altering medical outcomes', 81),
    ('82', 'Maternity Complications Coverage', 82),
    ('83', 'New-born coverage', 83),
    ('84', 'Telemedicine', 84)
) AS v(code, display_en, sort_order)
WHERE cs.code = 'benefit-category'
ON CONFLICT (code_system_id, code) DO UPDATE SET display_en = EXCLUDED.display_en;

-- =====================================================
-- 5. Insert Coverage Types
-- =====================================================
INSERT INTO nphies_codes (code_system_id, code, display_en, sort_order)
SELECT cs.code_system_id, v.code, v.display_en, v.sort_order
FROM nphies_code_systems cs
CROSS JOIN (VALUES
    ('EHCPOL', 'Extended Healthcare', 1),
    ('PUBLICPOL', 'Public Healthcare', 2),
    ('DENTAL', 'Dental Care', 3),
    ('MENTPOL', 'Mental Health Policy', 4),
    ('DRUGPOL', 'Drug Policy', 5)
) AS v(code, display_en, sort_order)
WHERE cs.code = 'coverage-type'
ON CONFLICT (code_system_id, code) DO UPDATE SET display_en = EXCLUDED.display_en;

-- =====================================================
-- 6. Insert Coverage Copay Types (Cost to Beneficiary)
-- =====================================================
INSERT INTO nphies_codes (code_system_id, code, display_en, sort_order)
SELECT cs.code_system_id, v.code, v.display_en, v.sort_order
FROM nphies_code_systems cs
CROSS JOIN (VALUES
    ('gpvisit', 'GP Visit Copay', 1),
    ('spvisit', 'Specialist Visit Copay', 2),
    ('copaypct', 'Copay Percentage', 3),
    ('maxcopay', 'Maximum Copay', 4),
    ('copay', 'Copay Amount', 5),
    ('deductible', 'Deductible', 6),
    ('coinsurance', 'Coinsurance', 7),
    ('emergency', 'Emergency Copay', 8),
    ('inpatient', 'Inpatient Copay', 9),
    ('outpatient', 'Outpatient Copay', 10),
    ('pharmacy', 'Pharmacy Copay', 11),
    ('dental', 'Dental Copay', 12),
    ('vision', 'Vision Copay', 13)
) AS v(code, display_en, sort_order)
WHERE cs.code = 'coverage-copay-type'
ON CONFLICT (code_system_id, code) DO UPDATE SET display_en = EXCLUDED.display_en;

-- =====================================================
-- 7. Insert Benefit Types
-- =====================================================
INSERT INTO nphies_codes (code_system_id, code, display_en, sort_order)
SELECT cs.code_system_id, v.code, v.display_en, v.sort_order
FROM nphies_code_systems cs
CROSS JOIN (VALUES
    ('benefit', 'Benefit Limit', 1),
    ('approval-limit', 'Approval Limit', 2),
    ('copay-percent', 'Copay Percentage', 3),
    ('copay-maximum', 'Maximum Copay', 4),
    ('copay', 'Copay Amount', 5),
    ('deductible', 'Deductible', 6),
    ('coinsurance', 'Coinsurance', 7),
    ('room', 'Room Type', 8),
    ('visit', 'Visit Limit', 9)
) AS v(code, display_en, sort_order)
WHERE cs.code = 'benefit-type'
ON CONFLICT (code_system_id, code) DO UPDATE SET display_en = EXCLUDED.display_en;

-- =====================================================
-- 8. Insert Site Eligibility Codes
-- =====================================================
INSERT INTO nphies_codes (code_system_id, code, display_en, sort_order)
SELECT cs.code_system_id, v.code, v.display_en, v.sort_order
FROM nphies_code_systems cs
CROSS JOIN (VALUES
    ('eligible', 'Patient is eligible for coverage at this site', 1),
    ('not-eligible', 'Patient is not eligible for coverage at this site', 2),
    ('not-in-network', 'Provider is not in the patient''s network', 3),
    ('plan-expired', 'Patient''s plan has expired', 4),
    ('coverage-suspended', 'Patient''s coverage is suspended', 5),
    ('benefit-exhausted', 'Patient''s benefits have been exhausted', 6)
) AS v(code, display_en, sort_order)
WHERE cs.code = 'site-eligibility'
ON CONFLICT (code_system_id, code) DO UPDATE SET display_en = EXCLUDED.display_en;

-- =====================================================
-- 9. Insert Identifier Types
-- =====================================================
INSERT INTO nphies_codes (code_system_id, code, display_en, sort_order)
SELECT cs.code_system_id, v.code, v.display_en, v.sort_order
FROM nphies_code_systems cs
CROSS JOIN (VALUES
    ('NI', 'National Identifier', 1),
    ('PPN', 'Passport Number', 2),
    ('VP', 'Visa Permit', 3),
    ('SB', 'Social Beneficiary Identifier', 4),
    ('MR', 'Medical Record Number', 5)
) AS v(code, display_en, sort_order)
WHERE cs.code = 'identifier-type'
ON CONFLICT (code_system_id, code) DO UPDATE SET display_en = EXCLUDED.display_en;

-- =====================================================
-- 10. Insert Provider Types
-- =====================================================
INSERT INTO nphies_codes (code_system_id, code, display_en, sort_order)
SELECT cs.code_system_id, v.code, v.display_en, v.sort_order
FROM nphies_code_systems cs
CROSS JOIN (VALUES
    ('1', 'Hospital', 1),
    ('2', 'Clinic', 2),
    ('3', 'Pharmacy', 3),
    ('4', 'Laboratory', 4),
    ('5', 'Dental', 5),
    ('6', 'Optical', 6),
    ('7', 'Home Health', 7),
    ('8', 'Nursing Home', 8)
) AS v(code, display_en, sort_order)
WHERE cs.code = 'provider-type'
ON CONFLICT (code_system_id, code) DO UPDATE SET display_en = EXCLUDED.display_en;

-- =====================================================
-- 11. Insert Marital Status Codes
-- =====================================================
INSERT INTO nphies_codes (code_system_id, code, display_en, sort_order)
SELECT cs.code_system_id, v.code, v.display_en, v.sort_order
FROM nphies_code_systems cs
CROSS JOIN (VALUES
    ('M', 'Married', 1),
    ('S', 'Single', 2),
    ('D', 'Divorced', 3),
    ('W', 'Widowed', 4),
    ('U', 'Unknown', 5),
    ('A', 'Annulled', 6),
    ('L', 'Legally Separated', 7),
    ('P', 'Polygamous', 8)
) AS v(code, display_en, sort_order)
WHERE cs.code = 'marital-status'
ON CONFLICT (code_system_id, code) DO UPDATE SET display_en = EXCLUDED.display_en;

-- =====================================================
-- 12. Insert Subscriber Relationship Codes
-- =====================================================
INSERT INTO nphies_codes (code_system_id, code, display_en, sort_order)
SELECT cs.code_system_id, v.code, v.display_en, v.sort_order
FROM nphies_code_systems cs
CROSS JOIN (VALUES
    ('self', 'Self', 1),
    ('spouse', 'Spouse', 2),
    ('child', 'Child', 3),
    ('parent', 'Parent', 4),
    ('common', 'Common Law Spouse', 5),
    ('other', 'Other', 6),
    ('injured', 'Injured Party', 7)
) AS v(code, display_en, sort_order)
WHERE cs.code = 'subscriber-relationship'
ON CONFLICT (code_system_id, code) DO UPDATE SET display_en = EXCLUDED.display_en;

-- =====================================================
-- 13. Insert Benefit Network Codes
-- =====================================================
INSERT INTO nphies_codes (code_system_id, code, display_en, sort_order)
SELECT cs.code_system_id, v.code, v.display_en, v.sort_order
FROM nphies_code_systems cs
CROSS JOIN (VALUES
    ('in', 'In Network', 1),
    ('out', 'Out of Network', 2)
) AS v(code, display_en, sort_order)
WHERE cs.code = 'benefit-network'
ON CONFLICT (code_system_id, code) DO UPDATE SET display_en = EXCLUDED.display_en;

-- =====================================================
-- 14. Insert Benefit Term Codes
-- =====================================================
INSERT INTO nphies_codes (code_system_id, code, display_en, sort_order)
SELECT cs.code_system_id, v.code, v.display_en, v.sort_order
FROM nphies_code_systems cs
CROSS JOIN (VALUES
    ('annual', 'Annual', 1),
    ('day', 'Per Day', 2),
    ('lifetime', 'Lifetime', 3),
    ('visit', 'Per Visit', 4)
) AS v(code, display_en, sort_order)
WHERE cs.code = 'benefit-term'
ON CONFLICT (code_system_id, code) DO UPDATE SET display_en = EXCLUDED.display_en;

-- =====================================================
-- 15. Insert Benefit Unit Codes
-- =====================================================
INSERT INTO nphies_codes (code_system_id, code, display_en, sort_order)
SELECT cs.code_system_id, v.code, v.display_en, v.sort_order
FROM nphies_code_systems cs
CROSS JOIN (VALUES
    ('individual', 'Individual', 1),
    ('family', 'Family', 2)
) AS v(code, display_en, sort_order)
WHERE cs.code = 'benefit-unit'
ON CONFLICT (code_system_id, code) DO UPDATE SET display_en = EXCLUDED.display_en;

-- =====================================================
-- 16. Insert Organization Types
-- =====================================================
INSERT INTO nphies_codes (code_system_id, code, display_en, sort_order)
SELECT cs.code_system_id, v.code, v.display_en, v.sort_order
FROM nphies_code_systems cs
CROSS JOIN (VALUES
    ('prov', 'Healthcare Provider', 1),
    ('ins', 'Insurance Company', 2),
    ('pay', 'Payer', 3),
    ('govt', 'Government', 4),
    ('other', 'Other', 5)
) AS v(code, display_en, sort_order)
WHERE cs.code = 'organization-type'
ON CONFLICT (code_system_id, code) DO UPDATE SET display_en = EXCLUDED.display_en;

-- =====================================================
-- 17. Insert Occupation Codes
-- =====================================================
INSERT INTO nphies_codes (code_system_id, code, display_en, sort_order)
SELECT cs.code_system_id, v.code, v.display_en, v.sort_order
FROM nphies_code_systems cs
CROSS JOIN (VALUES
    ('business', 'Business', 1),
    ('employee', 'Employee', 2),
    ('student', 'Student', 3),
    ('retired', 'Retired', 4),
    ('unemployed', 'Unemployed', 5),
    ('homemaker', 'Homemaker', 6),
    ('military', 'Military', 7),
    ('other', 'Other', 8)
) AS v(code, display_en, sort_order)
WHERE cs.code = 'occupation'
ON CONFLICT (code_system_id, code) DO UPDATE SET display_en = EXCLUDED.display_en;

-- =====================================================
-- 18. Insert KSA Administrative Gender
-- =====================================================
INSERT INTO nphies_codes (code_system_id, code, display_en, sort_order)
SELECT cs.code_system_id, v.code, v.display_en, v.sort_order
FROM nphies_code_systems cs
CROSS JOIN (VALUES
    ('male', 'Male', 1),
    ('female', 'Female', 2),
    ('unknown', 'Unknown', 3)
) AS v(code, display_en, sort_order)
WHERE cs.code = 'ksa-administrative-gender'
ON CONFLICT (code_system_id, code) DO UPDATE SET display_en = EXCLUDED.display_en;

-- =====================================================
-- Verify the data
-- =====================================================
SELECT 
    cs.name as code_system,
    COUNT(c.nphies_code_id) as code_count
FROM nphies_code_systems cs
LEFT JOIN nphies_codes c ON cs.code_system_id = c.code_system_id
GROUP BY cs.name
ORDER BY cs.name;

