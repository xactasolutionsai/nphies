// Database schema definitions and validation schemas
import Joi from 'joi';

// Database table schemas (for reference)
export const TABLE_SCHEMAS = {
  patients: {
    id: 'SERIAL PRIMARY KEY',
    name: 'VARCHAR(255) NOT NULL',
    identifier: 'VARCHAR(50) UNIQUE NOT NULL',
    gender: 'VARCHAR(10) NOT NULL CHECK (gender IN (\'Male\', \'Female\', \'Other\'))',
    birth_date: 'DATE NOT NULL',
    phone: 'VARCHAR(20)',
    email: 'VARCHAR(255)',
    address: 'TEXT',
    created_at: 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP',
    updated_at: 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP'
  },
  
  providers: {
    id: 'SERIAL PRIMARY KEY',
    name: 'VARCHAR(255) NOT NULL',
    type: 'VARCHAR(100) NOT NULL',
    nphies_id: 'VARCHAR(50) UNIQUE NOT NULL',
    address: 'TEXT',
    phone: 'VARCHAR(20)',
    email: 'VARCHAR(255)',
    contact_person: 'VARCHAR(255)',
    created_at: 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP',
    updated_at: 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP'
  },
  
  insurers: {
    id: 'SERIAL PRIMARY KEY',
    name: 'VARCHAR(255) NOT NULL',
    nphies_id: 'VARCHAR(50) UNIQUE NOT NULL',
    status: 'VARCHAR(20) DEFAULT \'Active\' CHECK (status IN (\'Active\', \'Inactive\', \'Suspended\'))',
    contact_person: 'VARCHAR(255)',
    phone: 'VARCHAR(20)',
    email: 'VARCHAR(255)',
    address: 'TEXT',
    created_at: 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP',
    updated_at: 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP'
  },
  
  authorizations: {
    id: 'SERIAL PRIMARY KEY',
    status: 'VARCHAR(20) NOT NULL CHECK (status IN (\'Approved\', \'Pending\', \'Rejected\', \'Under Review\'))',
    purpose: 'VARCHAR(255) NOT NULL',
    patient_id: 'INTEGER REFERENCES patients(id) ON DELETE CASCADE',
    provider_id: 'INTEGER REFERENCES providers(id) ON DELETE CASCADE',
    insurer_id: 'INTEGER REFERENCES insurers(id) ON DELETE CASCADE',
    amount: 'DECIMAL(10,2)',
    request_date: 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP',
    approval_date: 'TIMESTAMP',
    notes: 'TEXT',
    created_at: 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP',
    updated_at: 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP'
  },
  
  eligibility: {
    id: 'SERIAL PRIMARY KEY',
    purpose: 'VARCHAR(255) NOT NULL',
    patient_id: 'INTEGER REFERENCES patients(id) ON DELETE CASCADE',
    provider_id: 'INTEGER REFERENCES providers(id) ON DELETE CASCADE',
    insurer_id: 'INTEGER REFERENCES insurers(id) ON DELETE CASCADE',
    status: 'VARCHAR(20) NOT NULL CHECK (status IN (\'Eligible\', \'Not Eligible\', \'Pending\', \'Under Review\'))',
    coverage: 'VARCHAR(20)',
    request_date: 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP',
    response_date: 'TIMESTAMP',
    notes: 'TEXT',
    created_at: 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP',
    updated_at: 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP'
  },
  
  claims: {
    id: 'SERIAL PRIMARY KEY',
    claim_number: 'VARCHAR(50) UNIQUE NOT NULL',
    patient_id: 'INTEGER REFERENCES patients(id) ON DELETE CASCADE',
    provider_id: 'INTEGER REFERENCES providers(id) ON DELETE CASCADE',
    insurer_id: 'INTEGER REFERENCES insurers(id) ON DELETE CASCADE',
    authorization_id: 'INTEGER REFERENCES authorizations(id) ON DELETE SET NULL',
    status: 'VARCHAR(20) NOT NULL CHECK (status IN (\'Approved\', \'Pending\', \'Rejected\', \'Under Review\'))',
    amount: 'DECIMAL(10,2) NOT NULL',
    submission_date: 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP',
    processed_date: 'TIMESTAMP',
    description: 'TEXT',
    created_at: 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP',
    updated_at: 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP'
  },
  
  claim_batches: {
    id: 'SERIAL PRIMARY KEY',
    batch_identifier: 'VARCHAR(50) UNIQUE NOT NULL',
    provider_id: 'INTEGER REFERENCES providers(id) ON DELETE CASCADE',
    insurer_id: 'INTEGER REFERENCES insurers(id) ON DELETE CASCADE',
    status: 'VARCHAR(20) NOT NULL CHECK (status IN (\'Processed\', \'Pending\', \'Rejected\', \'Under Review\'))',
    total_amount: 'DECIMAL(12,2)',
    submission_date: 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP',
    processed_date: 'TIMESTAMP',
    description: 'TEXT',
    created_at: 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP',
    updated_at: 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP'
  },
  
  payments: {
    id: 'SERIAL PRIMARY KEY',
    payment_ref_number: 'VARCHAR(50) UNIQUE NOT NULL',
    provider_id: 'INTEGER REFERENCES providers(id) ON DELETE CASCADE',
    insurer_id: 'INTEGER REFERENCES insurers(id) ON DELETE CASCADE',
    claim_id: 'INTEGER REFERENCES claims(id) ON DELETE SET NULL',
    total_amount: 'DECIMAL(10,2) NOT NULL',
    payment_date: 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP',
    status: 'VARCHAR(20) NOT NULL CHECK (status IN (\'Completed\', \'Pending\', \'Failed\', \'Processing\'))',
    method: 'VARCHAR(50)',
    description: 'TEXT',
    created_at: 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP',
    updated_at: 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP'
  },
  
  standard_approvals_claims: {
    id: 'SERIAL PRIMARY KEY',
    form_number: 'VARCHAR(50) UNIQUE',
    patient_id: 'INTEGER REFERENCES patients(id) ON DELETE SET NULL',
    provider_id: 'INTEGER REFERENCES providers(id) ON DELETE SET NULL',
    insurer_id: 'INTEGER REFERENCES insurers(id) ON DELETE SET NULL',
    status: 'VARCHAR(20) DEFAULT \'Draft\' CHECK (status IN (\'Draft\', \'Submitted\', \'Approved\', \'Rejected\', \'Pending\'))',
    provider_name: 'VARCHAR(255)',
    insurance_company_name: 'VARCHAR(255)',
    tpa_company_name: 'VARCHAR(255)',
    patient_file_number: 'VARCHAR(50)',
    department: 'VARCHAR(100)',
    marital_status: 'VARCHAR(20) CHECK (marital_status IN (\'Single\', \'Married\'))',
    plan_type: 'VARCHAR(100)',
    date_of_visit: 'DATE',
    visit_type: 'VARCHAR(50) CHECK (visit_type IN (\'New visit\', \'Follow Up\', \'Refill\', \'walk in\', \'Referral\'))',
    insured_name: 'VARCHAR(255)',
    id_card_number: 'VARCHAR(50)',
    sex: 'VARCHAR(10)',
    age: 'INTEGER',
    policy_holder: 'VARCHAR(255)',
    policy_number: 'VARCHAR(50)',
    expiry_date: 'DATE',
    approval_field: 'VARCHAR(255)',
    patient_type: 'VARCHAR(20) CHECK (patient_type IN (\'Inpatient\', \'Outpatient\'))',
    emergency_case: 'BOOLEAN DEFAULT FALSE',
    emergency_care_level: 'INTEGER CHECK (emergency_care_level IN (1, 2, 3))',
    bp: 'VARCHAR(20)',
    pulse: 'INTEGER',
    temp: 'DECIMAL(5,2)',
    weight: 'DECIMAL(5,2)',
    height: 'DECIMAL(5,2)',
    respiratory_rate: 'INTEGER',
    duration_of_illness_days: 'INTEGER',
    chief_complaints: 'TEXT',
    significant_signs: 'TEXT',
    other_conditions: 'TEXT',
    diagnosis: 'TEXT',
    principal_code: 'VARCHAR(50)',
    second_code: 'VARCHAR(50)',
    third_code: 'VARCHAR(50)',
    fourth_code: 'VARCHAR(50)',
    chronic: 'BOOLEAN DEFAULT FALSE',
    congenital: 'BOOLEAN DEFAULT FALSE',
    rta: 'BOOLEAN DEFAULT FALSE',
    work_related: 'BOOLEAN DEFAULT FALSE',
    vaccination: 'BOOLEAN DEFAULT FALSE',
    check_up: 'BOOLEAN DEFAULT FALSE',
    psychiatric: 'BOOLEAN DEFAULT FALSE',
    infertility: 'BOOLEAN DEFAULT FALSE',
    pregnancy: 'BOOLEAN DEFAULT FALSE',
    completed_coded_by: 'VARCHAR(255)',
    provider_signature: 'VARCHAR(255)',
    provider_date: 'DATE',
    case_management_form_included: 'BOOLEAN DEFAULT FALSE',
    possible_line_of_management: 'TEXT',
    estimated_length_of_stay_days: 'INTEGER',
    expected_date_of_admission: 'DATE',
    physician_name: 'VARCHAR(255)',
    physician_signature: 'VARCHAR(255)',
    physician_stamp: 'VARCHAR(255)',
    physician_certification_date: 'DATE',
    patient_guardian_name: 'VARCHAR(255)',
    patient_guardian_relationship: 'VARCHAR(100)',
    patient_guardian_signature: 'VARCHAR(255)',
    patient_guardian_date: 'DATE',
    insurance_approval_status: 'VARCHAR(20) CHECK (insurance_approval_status IN (\'Approved\', \'Not Approved\'))',
    approval_number: 'VARCHAR(50)',
    approval_validity_days: 'INTEGER',
    insurance_comments: 'TEXT',
    approved_disapproved_by: 'VARCHAR(255)',
    insurance_signature: 'VARCHAR(255)',
    insurance_approval_date: 'DATE',
    created_at: 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP',
    updated_at: 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP'
  }
};

// Joi validation schemas
export const validationSchemas = {
  patient: Joi.object({
    name: Joi.string().min(2).max(255).required(),
    identifier: Joi.string().min(5).max(50).required(),
    gender: Joi.string().valid('Male', 'Female', 'Other').required(),
    birth_date: Joi.date().required(),
    phone: Joi.string().min(10).max(20).optional(),
    email: Joi.string().email().optional(),
    address: Joi.string().optional()
  }),
  
  provider: Joi.object({
    name: Joi.string().min(2).max(255).required(),
    type: Joi.string().min(2).max(100).required(),
    nphies_id: Joi.string().min(3).max(50).required(),
    address: Joi.string().optional(),
    phone: Joi.string().min(10).max(20).optional(),
    email: Joi.string().email().optional(),
    contact_person: Joi.string().optional()
  }),
  
  insurer: Joi.object({
    name: Joi.string().min(2).max(255).required(),
    nphies_id: Joi.string().min(3).max(50).required(),
    status: Joi.string().valid('Active', 'Inactive', 'Suspended').optional(),
    contact_person: Joi.string().optional(),
    phone: Joi.string().min(10).max(20).optional(),
    email: Joi.string().email().optional(),
    address: Joi.string().optional()
  }),
  
  authorization: Joi.object({
    status: Joi.string().valid('Approved', 'Pending', 'Rejected', 'Under Review').required(),
    purpose: Joi.string().min(2).max(255).required(),
    patient_id: Joi.number().integer().positive().required(),
    provider_id: Joi.number().integer().positive().required(),
    insurer_id: Joi.number().integer().positive().required(),
    amount: Joi.number().precision(2).positive().optional(),
    notes: Joi.string().optional()
  }),
  
  eligibility: Joi.object({
    purpose: Joi.string().min(2).max(255).required(),
    patient_id: Joi.number().integer().positive().required(),
    provider_id: Joi.number().integer().positive().required(),
    insurer_id: Joi.number().integer().positive().required(),
    status: Joi.string().valid('Eligible', 'Not Eligible', 'Pending', 'Under Review').required(),
    coverage: Joi.string().optional(),
    notes: Joi.string().optional()
  }),
  
  claim: Joi.object({
    claim_number: Joi.string().min(3).max(50).required(),
    patient_id: Joi.number().integer().positive().required(),
    provider_id: Joi.number().integer().positive().required(),
    insurer_id: Joi.number().integer().positive().required(),
    authorization_id: Joi.number().integer().positive().optional(),
    status: Joi.string().valid('Approved', 'Pending', 'Rejected', 'Under Review').required(),
    amount: Joi.number().precision(2).positive().required(),
    description: Joi.string().optional()
  }),
  
  claimBatch: Joi.object({
    batch_identifier: Joi.string().min(3).max(50).required(),
    provider_id: Joi.number().integer().positive().required(),
    insurer_id: Joi.number().integer().positive().required(),
    status: Joi.string().valid('Processed', 'Pending', 'Rejected', 'Under Review').required(),
    total_amount: Joi.number().precision(2).positive().optional(),
    description: Joi.string().optional()
  }),
  
  payment: Joi.object({
    payment_ref_number: Joi.string().min(3).max(50).required(),
    provider_id: Joi.number().integer().positive().required(),
    insurer_id: Joi.number().integer().positive().required(),
    claim_id: Joi.number().integer().positive().optional(),
    total_amount: Joi.number().precision(2).positive().required(),
    status: Joi.string().valid('Completed', 'Pending', 'Failed', 'Processing').required(),
    method: Joi.string().optional(),
    description: Joi.string().optional()
  }),
  
  standardApprovalClaim: Joi.object({
    form_number: Joi.string().max(50).allow(null, '').optional(),
    patient_id: Joi.string().uuid().allow(null, '').optional(),
    provider_id: Joi.string().uuid().allow(null, '').optional(),
    insurer_id: Joi.string().uuid().allow(null, '').optional(),
    status: Joi.string().valid('Draft', 'Submitted', 'Approved', 'Rejected', 'Pending').allow(null, '').optional(),
    provider_name: Joi.string().max(255).allow(null, '').optional(),
    insurance_company_name: Joi.string().max(255).allow(null, '').optional(),
    tpa_company_name: Joi.string().max(255).allow(null, '').optional(),
    patient_file_number: Joi.string().max(50).allow(null, '').optional(),
    department: Joi.string().max(100).allow(null, '').optional(),
    marital_status: Joi.string().valid('Single', 'Married').allow(null, '').optional(),
    plan_type: Joi.string().max(100).allow(null, '').optional(),
    date_of_visit: Joi.date().allow(null, '').optional(),
    visit_type: Joi.string().valid('New visit', 'Follow Up', 'Refill', 'walk in', 'Referral').allow(null, '').optional(),
    insured_name: Joi.string().max(255).allow(null, '').optional(),
    id_card_number: Joi.string().max(50).allow(null, '').optional(),
    sex: Joi.string().max(10).allow(null, '').optional(),
    age: Joi.number().integer().min(0).max(150).allow(null, '').optional(),
    policy_holder: Joi.string().max(255).allow(null, '').optional(),
    policy_number: Joi.string().max(50).allow(null, '').optional(),
    expiry_date: Joi.date().allow(null, '').optional(),
    approval_field: Joi.string().max(255).allow(null, '').optional(),
    patient_type: Joi.string().valid('Inpatient', 'Outpatient').allow(null, '').optional(),
    emergency_case: Joi.boolean().allow(null).optional(),
    emergency_care_level: Joi.when('emergency_case', {
      is: true,
      then: Joi.number().integer().valid(1, 2, 3).required(),
      otherwise: Joi.number().integer().valid(1, 2, 3).allow(null, '').optional()
    }),
    bp: Joi.string().max(20).allow(null, '').optional(),
    pulse: Joi.number().integer().min(0).allow(null, '').optional(),
    temp: Joi.number().precision(2).allow(null, '').optional(),
    weight: Joi.number().precision(2).positive().allow(null, '').optional(),
    height: Joi.number().precision(2).positive().allow(null, '').optional(),
    respiratory_rate: Joi.number().integer().min(0).allow(null, '').optional(),
    duration_of_illness_days: Joi.number().integer().min(0).allow(null, '').optional(),
    chief_complaints: Joi.string().allow(null, '').optional(),
    significant_signs: Joi.string().allow(null, '').optional(),
    other_conditions: Joi.string().allow(null, '').optional(),
    diagnosis: Joi.string().allow(null, '').optional(),
    principal_code: Joi.string().max(50).allow(null, '').optional(),
    second_code: Joi.string().max(50).allow(null, '').optional(),
    third_code: Joi.string().max(50).allow(null, '').optional(),
    fourth_code: Joi.string().max(50).allow(null, '').optional(),
    chronic: Joi.boolean().allow(null).optional(),
    congenital: Joi.boolean().allow(null).optional(),
    rta: Joi.boolean().allow(null).optional(),
    work_related: Joi.boolean().allow(null).optional(),
    vaccination: Joi.boolean().allow(null).optional(),
    check_up: Joi.boolean().allow(null).optional(),
    psychiatric: Joi.boolean().allow(null).optional(),
    infertility: Joi.boolean().allow(null).optional(),
    pregnancy: Joi.boolean().allow(null).optional(),
    completed_coded_by: Joi.string().max(255).allow(null, '').optional(),
    provider_signature: Joi.string().max(255).allow(null, '').optional(),
    provider_date: Joi.date().allow(null, '').optional(),
    case_management_form_included: Joi.boolean().allow(null).optional(),
    possible_line_of_management: Joi.string().allow(null, '').optional(),
    estimated_length_of_stay_days: Joi.number().integer().min(0).allow(null, '').optional(),
    expected_date_of_admission: Joi.date().allow(null, '').optional(),
    management_items: Joi.array().items(Joi.object({
      code: Joi.string().max(50).allow(null, '').optional(),
      description: Joi.string().max(255).allow(null, '').optional(),
      type: Joi.string().max(100).allow(null, '').optional(),
      quantity: Joi.number().integer().min(0).allow(null, '').optional(),
      cost: Joi.number().precision(2).min(0).allow(null, '').optional()
    })).optional(),
    medications: Joi.array().items(Joi.object({
      medication_name: Joi.string().max(255).allow(null, '').optional(),
      type: Joi.string().max(100).allow(null, '').optional(),
      quantity: Joi.number().integer().min(0).allow(null, '').optional()
    })).optional()
  }),

  // Prior Authorization validation schema (NPHIES-compliant)
  priorAuthorization: Joi.object({
    request_number: Joi.string().max(50).allow(null, '').optional(),
    auth_type: Joi.string().valid('institutional', 'professional', 'pharmacy', 'dental', 'vision').required(),
    
    // Foreign Keys (UUID format)
    patient_id: Joi.string().uuid().allow(null, '').optional(),
    provider_id: Joi.string().uuid().allow(null, '').optional(),
    insurer_id: Joi.string().uuid().allow(null, '').optional(),
    coverage_id: Joi.string().uuid().allow(null, '').optional(),
    practitioner_id: Joi.string().uuid().allow(null, '').optional(),
    
    // Practice Code / Specialty (NPHIES careTeam.qualification)
    practice_code: Joi.string().max(20).allow(null, '').optional(),
    
    // Service Event Type (NPHIES dental claims: ICSE for initial, SCSE for subsequent)
    service_event_type: Joi.string().valid('ICSE', 'SCSE').allow(null, '').optional(),
    
    // Status
    status: Joi.string().valid('draft', 'pending', 'queued', 'approved', 'partial', 'denied', 'cancelled', 'error').allow(null, '').optional(),
    outcome: Joi.string().valid('complete', 'partial', 'queued', 'error').allow(null, '').optional(),
    disposition: Joi.string().allow(null, '').optional(),
    
    // NPHIES Fields
    pre_auth_ref: Joi.string().max(100).allow(null, '').optional(),
    nphies_request_id: Joi.string().max(100).allow(null, '').optional(),
    nphies_response_id: Joi.string().max(100).allow(null, '').optional(),
    is_nphies_generated: Joi.boolean().allow(null).optional(),
    
    // NPHIES Response Fields (from ClaimResponse)
    nphies_message_id: Joi.string().max(255).allow(null, '').optional(),
    nphies_response_code: Joi.string().max(50).allow(null, '').optional(),
    original_request_identifier: Joi.string().max(255).allow(null, '').optional(),
    insurance_sequence: Joi.number().integer().allow(null).optional(),
    insurance_focal: Joi.boolean().allow(null).optional(),
    claim_response_status: Joi.string().max(50).allow(null, '').optional(),
    claim_response_use: Joi.string().max(50).allow(null, '').optional(),
    claim_response_created: Joi.date().allow(null, '').optional(),
    
    // Encounter
    encounter_class: Joi.string().valid('inpatient', 'outpatient', 'daycase', 'emergency', 'ambulatory', 'home', 'telemedicine').allow(null, '').optional(),
    encounter_start: Joi.date().allow(null, '').optional(),
    encounter_end: Joi.date().allow(null, '').optional(),
    encounter_identifier: Joi.string().max(255).allow(null, '').optional(),
    service_type: Joi.string().max(100).allow(null, '').optional(),
    admit_source: Joi.string().max(20).allow(null, '').optional(), // NPHIES: hospitalization.admitSource code
    
    // Emergency Encounter Fields (per NPHIES Encounter-10122)
    triage_category: Joi.string().valid('I', 'VU', 'U', 'S', 'NS').allow(null, '').optional(),
    triage_date: Joi.date().allow(null, '').optional(),
    encounter_priority: Joi.string().valid('EM', 'UR', 'S', 'A', 'R', 'EL', 'CR', 'CS', 'CSP', 'CSR', 'P', 'PRN', 'RR', 'T', 'UD').allow(null, '').optional(),
    
    // Eligibility Response Identifier (per NPHIES Claim-173086)
    eligibility_response_id: Joi.string().max(255).allow(null, '').optional(),
    eligibility_response_system: Joi.string().max(500).allow(null, '').optional(),
    
    // Workflow
    is_update: Joi.boolean().allow(null).optional(),
    related_auth_id: Joi.number().integer().allow(null).optional(),
    is_transfer: Joi.boolean().allow(null).optional(),
    transfer_provider_id: Joi.string().uuid().allow(null, '').optional(),
    transfer_auth_number: Joi.string().max(100).allow(null, '').optional(),
    transfer_period_start: Joi.date().allow(null, '').optional(),
    transfer_period_end: Joi.date().allow(null, '').optional(),
    is_cancelled: Joi.boolean().allow(null).optional(),
    cancellation_reason: Joi.string().allow(null, '').optional(),
    
    // Eligibility Reference
    eligibility_ref: Joi.string().max(100).allow(null, '').optional(),
    eligibility_offline_date: Joi.date().allow(null, '').optional(),
    eligibility_offline_ref: Joi.string().max(255).allow(null, '').optional(),
    
    // Clinical
    diagnosis_codes: Joi.string().allow(null, '').optional(),
    primary_diagnosis: Joi.string().max(50).allow(null, '').optional(),
    
    // Priority
    priority: Joi.string().valid('stat', 'normal', 'deferred').allow(null, '').optional(),
    
    // Financial
    total_amount: Joi.number().precision(2).allow(null).optional(),
    approved_amount: Joi.number().precision(2).allow(null).optional(),
    eligible_amount: Joi.number().precision(2).allow(null).optional(),
    benefit_amount: Joi.number().precision(2).allow(null).optional(),
    copay_amount: Joi.number().precision(2).allow(null).optional(),
    currency: Joi.string().max(3).allow(null, '').optional(),
    
    // Adjudication (NPHIES response fields)
    adjudication_outcome: Joi.string().valid('approved', 'rejected', 'partial', 'pended').allow(null, '').optional(),
    sub_type: Joi.string().max(50).allow(null, '').optional(),
    vision_prescription: Joi.object().allow(null).optional(),
    
    // Pre-auth period
    pre_auth_period_start: Joi.date().allow(null, '').optional(),
    pre_auth_period_end: Joi.date().allow(null, '').optional(),
    
    // Nested arrays
    items: Joi.array().items(Joi.object({
      sequence: Joi.number().integer().min(1).required(),
      product_or_service_code: Joi.string().max(50).required(),
      product_or_service_system: Joi.string().max(255).allow(null, '').optional(),
      product_or_service_display: Joi.string().max(255).allow(null, '').optional(),
      tooth_number: Joi.string().max(10).allow(null, '').optional(),
      tooth_display: Joi.string().max(100).allow(null, '').optional(),
      tooth_surface: Joi.string().max(50).allow(null, '').optional(),
      eye: Joi.string().valid('left', 'right', 'both').allow(null, '').optional(),
      medication_code: Joi.string().max(50).allow(null, '').optional(),
      medication_system: Joi.string().max(255).allow(null, '').optional(),
      days_supply: Joi.number().integer().allow(null).optional(),
      quantity: Joi.number().precision(2).allow(null).optional(),
      unit_price: Joi.number().precision(2).allow(null).optional(),
      net_amount: Joi.number().precision(2).allow(null).optional(),
      currency: Joi.string().max(3).allow(null, '').optional(),
      serviced_date: Joi.date().allow(null, '').optional(),
      serviced_period_start: Joi.date().allow(null, '').optional(),
      serviced_period_end: Joi.date().allow(null, '').optional(),
      body_site_code: Joi.string().max(50).allow(null, '').optional(),
      body_site_system: Joi.string().max(255).allow(null, '').optional(),
      sub_site_code: Joi.string().max(50).allow(null, '').optional(),
      description: Joi.string().allow(null, '').optional(),
      notes: Joi.string().allow(null, '').optional(),
      // Additional optional fields
      patient_share: Joi.number().precision(2).allow(null).optional(),
      payer_share: Joi.number().precision(2).allow(null).optional(),
      is_maternity: Joi.boolean().allow(null).optional(),
      diagnosis_sequences: Joi.array().items(Joi.number().integer()).allow(null).optional(),
      information_sequences: Joi.array().items(Joi.number().integer()).allow(null).optional()
    })).optional(),
    
    supporting_info: Joi.array().items(Joi.object({
      sequence: Joi.number().integer().min(1).required(),
      category: Joi.string().max(50).required(),
      category_system: Joi.string().max(255).allow(null, '').optional(),
      code: Joi.string().max(50).allow(null, '').optional(),
      code_system: Joi.string().max(255).allow(null, '').optional(),
      code_display: Joi.string().max(255).allow(null, '').optional(),
      code_text: Joi.string().allow(null, '').optional(), // Free text for chief-complaint
      value_string: Joi.string().allow(null, '').optional(),
      value_quantity: Joi.number().precision(2).allow(null).optional(),
      value_quantity_unit: Joi.string().max(50).allow(null, '').optional(),
      value_boolean: Joi.boolean().allow(null).optional(),
      value_date: Joi.date().allow(null, '').optional(),
      value_period_start: Joi.date().allow(null, '').optional(),
      value_period_end: Joi.date().allow(null, '').optional(),
      value_reference: Joi.string().max(255).allow(null, '').optional(),
      timing_date: Joi.date().allow(null, '').optional(),
      timing_period_start: Joi.date().allow(null, '').optional(),
      timing_period_end: Joi.date().allow(null, '').optional(),
      reason_code: Joi.string().max(50).allow(null, '').optional(),
      reason_system: Joi.string().max(255).allow(null, '').optional()
    })).optional(),
    
    diagnoses: Joi.array().items(Joi.object({
      sequence: Joi.number().integer().min(1).required(),
      diagnosis_code: Joi.string().max(50).required(),
      diagnosis_system: Joi.string().max(255).allow(null, '').optional(),
      diagnosis_display: Joi.string().max(255).allow(null, '').optional(),
      diagnosis_type: Joi.string().valid('principal', 'secondary', 'admitting', 'discharge').allow(null, '').optional(),
      on_admission: Joi.boolean().allow(null).optional()
    })).optional(),
    
    attachments: Joi.array().items(Joi.object({
      file_name: Joi.string().max(255).required(),
      content_type: Joi.string().max(100).required(),
      file_size: Joi.number().integer().allow(null).optional(),
      base64_content: Joi.string().required(),
      title: Joi.string().max(255).allow(null, '').optional(),
      description: Joi.string().allow(null, '').optional(),
      category: Joi.string().max(50).allow(null, '').optional()
    })).optional(),
    
    // Clinical Documents (PDF uploads for future use)
    clinical_documents: Joi.array().items(Joi.object({
      id: Joi.string().max(100).optional(),
      name: Joi.string().max(255).required(),
      size: Joi.number().integer().allow(null).optional(),
      type: Joi.string().max(100).allow(null, '').optional(),
      data: Joi.string().allow(null, '').optional(), // base64 data
      uploadedAt: Joi.string().allow(null, '').optional()
    })).optional(),
    
    // Vision Prescription data (for vision auth types only)
    vision_prescription: Joi.object({
      product_type: Joi.string().valid('lens', 'contact').allow(null, '').optional(),
      date_written: Joi.date().allow(null, '').optional(),
      prescriber_license: Joi.string().max(100).allow(null, '').optional(),
      right_eye: Joi.object({
        sphere: Joi.alternatives().try(Joi.number(), Joi.string().allow('', null)).optional(),
        cylinder: Joi.alternatives().try(Joi.number(), Joi.string().allow('', null)).optional(),
        axis: Joi.alternatives().try(Joi.number(), Joi.string().allow('', null)).optional(),
        add: Joi.alternatives().try(Joi.number(), Joi.string().allow('', null)).optional(),
        prism_amount: Joi.alternatives().try(Joi.number(), Joi.string().allow('', null)).optional(),
        prism_base: Joi.string().valid('up', 'down', 'in', 'out').allow(null, '').optional()
      }).optional(),
      left_eye: Joi.object({
        sphere: Joi.alternatives().try(Joi.number(), Joi.string().allow('', null)).optional(),
        cylinder: Joi.alternatives().try(Joi.number(), Joi.string().allow('', null)).optional(),
        axis: Joi.alternatives().try(Joi.number(), Joi.string().allow('', null)).optional(),
        add: Joi.alternatives().try(Joi.number(), Joi.string().allow('', null)).optional(),
        prism_amount: Joi.alternatives().try(Joi.number(), Joi.string().allow('', null)).optional(),
        prism_base: Joi.string().valid('up', 'down', 'in', 'out').allow(null, '').optional()
      }).optional()
    }).allow(null).optional()
  }),

  // Prior Authorization Item validation schema
  priorAuthorizationItem: Joi.object({
    prior_auth_id: Joi.number().integer().required(),
    sequence: Joi.number().integer().min(1).required(),
    product_or_service_code: Joi.string().max(50).required(),
    product_or_service_system: Joi.string().max(255).allow(null, '').optional(),
    product_or_service_display: Joi.string().max(255).allow(null, '').optional(),
    tooth_number: Joi.string().max(10).allow(null, '').optional(),
    tooth_surface: Joi.string().max(50).allow(null, '').optional(),
    eye: Joi.string().valid('left', 'right', 'both').allow(null, '').optional(),
    medication_code: Joi.string().max(50).allow(null, '').optional(),
    medication_system: Joi.string().max(255).allow(null, '').optional(),
    days_supply: Joi.number().integer().allow(null).optional(),
    quantity: Joi.number().precision(2).allow(null).optional(),
    unit_price: Joi.number().precision(2).allow(null).optional(),
    net_amount: Joi.number().precision(2).allow(null).optional(),
    currency: Joi.string().max(3).allow(null, '').optional(),
    serviced_date: Joi.date().allow(null, '').optional(),
    serviced_period_start: Joi.date().allow(null, '').optional(),
    serviced_period_end: Joi.date().allow(null, '').optional(),
    body_site_code: Joi.string().max(50).allow(null, '').optional(),
    body_site_system: Joi.string().max(255).allow(null, '').optional(),
    sub_site_code: Joi.string().max(50).allow(null, '').optional(),
    description: Joi.string().allow(null, '').optional(),
    notes: Joi.string().allow(null, '').optional()
  }),

  // Claim Submission validation schema (NPHIES Claims - use: "claim")
  claimSubmission: Joi.object({
    claim_number: Joi.string().max(50).allow(null, '').optional(),
    claim_type: Joi.string().valid('institutional', 'professional', 'pharmacy', 'dental', 'vision').required(),
    sub_type: Joi.string().max(50).allow(null, '').optional(),
    
    // Foreign Keys (UUID format)
    patient_id: Joi.string().uuid().allow(null, '').optional(),
    provider_id: Joi.string().uuid().allow(null, '').optional(),
    insurer_id: Joi.string().uuid().allow(null, '').optional(),
    coverage_id: Joi.string().uuid().allow(null, '').optional(),
    practitioner_id: Joi.string().uuid().allow(null, '').optional(),
    prior_auth_id: Joi.number().integer().allow(null).optional(),
    
    // Prior Authorization Reference
    pre_auth_ref: Joi.string().max(100).allow(null, '').optional(),
    pre_auth_period_start: Joi.date().allow(null, '').optional(),
    pre_auth_period_end: Joi.date().allow(null, '').optional(),
    
    // Status
    status: Joi.string().valid('draft', 'pending', 'queued', 'approved', 'partial', 'denied', 'error').allow(null, '').optional(),
    outcome: Joi.string().valid('complete', 'partial', 'queued', 'error').allow(null, '').optional(),
    adjudication_outcome: Joi.string().valid('approved', 'rejected', 'partial', 'pended').allow(null, '').optional(),
    disposition: Joi.string().allow(null, '').optional(),
    
    // NPHIES Fields
    nphies_claim_id: Joi.string().max(100).allow(null, '').optional(),
    nphies_request_id: Joi.string().max(100).allow(null, '').optional(),
    nphies_response_id: Joi.string().max(100).allow(null, '').optional(),
    is_nphies_generated: Joi.boolean().allow(null).optional(),
    
    // Encounter
    encounter_class: Joi.string().valid('inpatient', 'outpatient', 'daycase', 'emergency', 'ambulatory', 'home', 'telemedicine').allow(null, '').optional(),
    encounter_start: Joi.date().allow(null, '').optional(),
    encounter_end: Joi.date().allow(null, '').optional(),
    encounter_identifier: Joi.string().max(255).allow(null, '').optional(),
    service_type: Joi.string().max(100).allow(null, '').optional(),
    
    // Eligibility Reference
    eligibility_ref: Joi.string().max(100).allow(null, '').optional(),
    eligibility_offline_date: Joi.date().allow(null, '').optional(),
    eligibility_offline_ref: Joi.string().max(255).allow(null, '').optional(),
    
    // Service
    service_date: Joi.date().allow(null, '').optional(),
    practice_code: Joi.string().max(20).allow(null, '').optional(),
    admit_source: Joi.string().max(20).allow(null, '').optional(),
    episode_identifier: Joi.string().max(100).allow(null, '').optional(),
    
    // Priority
    priority: Joi.string().valid('stat', 'normal', 'deferred').allow(null, '').optional(),
    
    // Financial
    total_amount: Joi.number().precision(2).allow(null).optional(),
    approved_amount: Joi.number().precision(2).allow(null).optional(),
    currency: Joi.string().max(3).allow(null, '').optional(),
    
    // Nested arrays
    items: Joi.array().items(Joi.object({
      sequence: Joi.number().integer().min(1).required(),
      product_or_service_code: Joi.string().max(50).required(),
      product_or_service_system: Joi.string().max(255).allow(null, '').optional(),
      product_or_service_display: Joi.string().max(255).allow(null, '').optional(),
      quantity: Joi.number().precision(2).allow(null).optional(),
      unit_price: Joi.number().precision(2).allow(null).optional(),
      factor: Joi.number().precision(4).allow(null).optional(),
      tax: Joi.number().precision(2).allow(null).optional(),
      patient_share: Joi.number().precision(2).allow(null).optional(),
      payer_share: Joi.number().precision(2).allow(null).optional(),
      net_amount: Joi.number().precision(2).allow(null).optional(),
      currency: Joi.string().max(3).allow(null, '').optional(),
      serviced_date: Joi.date().allow(null, '').optional(),
      is_package: Joi.boolean().allow(null).optional(),
      is_maternity: Joi.boolean().allow(null).optional(),
      patient_invoice: Joi.string().max(100).allow(null, '').optional()
    })).optional(),
    
    supporting_info: Joi.array().items(Joi.object({
      sequence: Joi.number().integer().min(1).required(),
      category: Joi.string().max(50).required(),
      code: Joi.string().max(50).allow(null, '').optional(),
      code_system: Joi.string().max(255).allow(null, '').optional(),
      code_display: Joi.string().max(255).allow(null, '').optional(),
      code_text: Joi.string().allow(null, '').optional(),
      value_string: Joi.string().allow(null, '').optional(),
      value_quantity: Joi.number().precision(2).allow(null).optional(),
      value_quantity_unit: Joi.string().max(50).allow(null, '').optional(),
      timing_date: Joi.date().allow(null, '').optional()
    })).optional(),
    
    diagnoses: Joi.array().items(Joi.object({
      sequence: Joi.number().integer().min(1).required(),
      diagnosis_code: Joi.string().max(50).required(),
      diagnosis_system: Joi.string().max(255).allow(null, '').optional(),
      diagnosis_display: Joi.string().max(255).allow(null, '').optional(),
      diagnosis_type: Joi.string().valid('principal', 'secondary', 'admitting', 'discharge').allow(null, '').optional(),
      on_admission: Joi.boolean().allow(null).optional(),
      condition_onset: Joi.string().max(10).allow(null, '').optional()
    })).optional(),
    
    attachments: Joi.array().items(Joi.object({
      file_name: Joi.string().max(255).required(),
      content_type: Joi.string().max(100).required(),
      file_size: Joi.number().integer().allow(null).optional(),
      base64_content: Joi.string().required(),
      title: Joi.string().max(255).allow(null, '').optional(),
      description: Joi.string().allow(null, '').optional(),
      category: Joi.string().max(50).allow(null, '').optional()
    })).optional()
  })
};

// Note: QUERY_PATTERNS have been moved to /db/queries.js for centralized management
