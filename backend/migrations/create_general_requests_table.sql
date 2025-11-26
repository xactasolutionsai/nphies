-- Migration: Create General Requests Table
-- Description: Table to store general request forms with AI validation results
-- Date: 2025-11-11

-- Create general_requests table
CREATE TABLE IF NOT EXISTS general_requests (
    id SERIAL PRIMARY KEY,
    form_number VARCHAR(50) UNIQUE,
    
    -- Foreign keys
    patient_id UUID REFERENCES patients(patient_id) ON DELETE SET NULL,
    provider_id UUID REFERENCES providers(provider_id) ON DELETE SET NULL,
    insurer_id UUID REFERENCES insurers(insurer_id) ON DELETE SET NULL,
    
    -- Status
    status VARCHAR(20) DEFAULT 'Draft' CHECK (status IN ('Draft', 'Submitted', 'Approved', 'Rejected', 'Pending')),
    
    -- Patient Information (stored as JSONB for flexibility)
    patient_data JSONB,
    -- Structure: {
    --   fullName, idNumber, fileNumber, dob, age, gender,
    --   contactPhone, email, vitals: {bloodPressure, temperature, pulse, respiratoryRate, weight, height},
    --   otherConditions, chiefComplaints, significantSigns, durationOfIllnessDays,
    --   maritalStatus, planType
    -- }
    
    -- Insured Information
    insured_data JSONB,
    -- Structure: { name, idCardNumber }
    
    -- Provider Information
    provider_data JSONB,
    -- Structure: {
    --   facilityName, doctorName, licenseNumber, department,
    --   contactPhone, email, completedCodedBy, signature, date
    -- }
    
    -- Coverage Information
    coverage_data JSONB,
    -- Structure: {
    --   insurer, contactPerson, phone, coverageType, tpaCompanyName,
    --   policyHolder, policyNumber, expiryDate, approvalField
    -- }
    
    -- Encounter Information
    encounter_class VARCHAR(50),
    encounter_start TIMESTAMP,
    encounter_end TIMESTAMP,
    
    -- Service Details
    service_data JSONB,
    -- Structure: {
    --   description, diagnosis, previousTest, testResults, medicalPlan,
    --   startDate, urgency, visitType, emergencyCase, emergencyCareLevel,
    --   bodyPart, laterality, cptCodes, icd10Codes,
    --   principalCode, secondCode, thirdCode, fourthCode,
    --   conditions: {chronic, congenital, rta, workRelated, vaccination, checkUp, psychiatric, infertility, pregnancy},
    --   caseManagementFormIncluded, possibleLineOfManagement, estimatedLengthOfStayDays, expectedDateOfAdmission
    -- }
    
    -- Management Items (array of objects)
    management_items JSONB DEFAULT '[]'::jsonb,
    -- Structure: [{ code, description, type, quantity, cost }, ...]
    
    -- Medications (array of objects)
    medications JSONB DEFAULT '[]'::jsonb,
    -- Structure: [{
    --   medicationName, type, quantity, mrid, activeIngredient, strength, unit,
    --   dosageForm, brands, hasInteractions, hasSideEffects, hasAgeWarning,
    --   hasPregnancyWarning, isDuplicate
    -- }, ...]
    
    -- Medication Safety Analysis
    medication_safety_analysis JSONB,
    -- Structure: { full AI analysis result }
    
    -- AI Validation Results (stored after validation)
    validation_results JSONB,
    -- Structure: {
    --   traditional: { success, fit, diagnoses, requiresPrerequisites, prerequisitesNeeded },
    --   aiEnhanced: { criticalPrerequisites, prerequisiteChain, reasoning, ... },
    --   metadata: { timestamp, bothSystemsRan }
    -- }
    
    -- Prerequisite Justification (user-provided justification)
    prerequisite_justification TEXT,
    
    -- Attachments
    attachments JSONB DEFAULT '[]'::jsonb,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    submitted_at TIMESTAMP,
    approved_at TIMESTAMP,
    rejected_at TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_general_requests_form_number ON general_requests(form_number);
CREATE INDEX IF NOT EXISTS idx_general_requests_patient_id ON general_requests(patient_id);
CREATE INDEX IF NOT EXISTS idx_general_requests_provider_id ON general_requests(provider_id);
CREATE INDEX IF NOT EXISTS idx_general_requests_insurer_id ON general_requests(insurer_id);
CREATE INDEX IF NOT EXISTS idx_general_requests_status ON general_requests(status);
CREATE INDEX IF NOT EXISTS idx_general_requests_created_at ON general_requests(created_at);

-- Create GIN indexes for JSONB columns to enable efficient querying
CREATE INDEX IF NOT EXISTS idx_general_requests_patient_data ON general_requests USING GIN (patient_data);
CREATE INDEX IF NOT EXISTS idx_general_requests_service_data ON general_requests USING GIN (service_data);
CREATE INDEX IF NOT EXISTS idx_general_requests_medications ON general_requests USING GIN (medications);
CREATE INDEX IF NOT EXISTS idx_general_requests_validation_results ON general_requests USING GIN (validation_results);

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_general_requests_updated_at 
    BEFORE UPDATE ON general_requests
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Comments
COMMENT ON TABLE general_requests IS 'Stores general request forms with AI validation results and prerequisite justifications';
COMMENT ON COLUMN general_requests.patient_data IS 'Patient information stored as JSONB for flexibility';
COMMENT ON COLUMN general_requests.validation_results IS 'AI and traditional validation results stored as JSONB';
COMMENT ON COLUMN general_requests.prerequisite_justification IS 'User-provided justification for prerequisites or fit issues';

COMMIT;

