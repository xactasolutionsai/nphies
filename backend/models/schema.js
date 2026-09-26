// Database schema definitions and validation schemas
import Joi from 'joi';


// Joi validation schemas
export const validationSchemas = {
  patient: Joi.object({
    // Required fields
    name: Joi.string().min(2).max(255).required(),
    identifier: Joi.string().min(5).max(50).required(),
    gender: Joi.string().valid('male', 'female', 'other', 'unknown').required(),
    birth_date: Joi.date().required(),
    // Optional fields
    phone: Joi.string().max(50).allow('', null).optional(),
    email: Joi.string().email().allow('', null).optional(),
    identifier_type: Joi.string().valid('national_id', 'iqama', 'passport', 'mrn', 'border_number', 'displaced_person').allow('', null).optional(),
    nationality: Joi.string().max(10).allow('', null).optional(),
    marital_status: Joi.string().valid('A', 'D', 'I', 'L', 'M', 'P', 'S', 'T', 'W', 'U', 'single', 'married', 'divorced', 'widowed', 'annulled', 'separated', 'unknown').insensitive().allow(null, '').optional(),
    address: Joi.string().allow('', null).optional(),
    city: Joi.string().max(100).allow('', null).optional(),
    country: Joi.string().max(10).allow('', null).optional(),
    occupation: Joi.string().max(255).allow('', null).optional(),
    is_newborn: Joi.boolean().optional(),
    nphies_patient_id: Joi.string().max(255).allow('', null).optional(),
    identifier_system: Joi.string().max(255).allow('', null).optional(),
    telecom: Joi.object().allow(null).optional(),
    address_details: Joi.object().allow(null).optional()
  }),
  
  provider: Joi.object({
    provider_name: Joi.string().min(2).max(255).required(),
    type: Joi.string().max(100).optional().allow('', null),
    nphies_id: Joi.string().max(50).optional().allow('', null),
    address: Joi.string().optional().allow('', null),
    phone: Joi.string().max(20).optional().allow('', null),
    email: Joi.string().email().optional().allow('', null),
    doctor_name: Joi.string().max(255).optional().allow('', null),
    department: Joi.string().max(255).optional().allow('', null),
    provider_type: Joi.string().max(100).optional().allow('', null),
    location_license: Joi.string().max(100).optional().allow('', null),
    contact_person: Joi.string().optional().allow('', null)
  }),
  
  insurer: Joi.object({
    insurer_name: Joi.string().min(2).max(255).required(),
    nphies_id: Joi.string().max(50).optional().allow('', null),
    status: Joi.string().valid('Active', 'Inactive', 'Suspended', 'Pending').optional().allow('', null),
    contact_person: Joi.string().optional().allow('', null),
    phone: Joi.string().max(20).optional().allow('', null),
    email: Joi.string().email().optional().allow('', null),
    address: Joi.string().optional().allow('', null),
    plan_type: Joi.string().max(100).optional().allow('', null)
  }),
  
  // Legacy tables (authorizations, eligibility, claims) use UUID keys; keys below are the real
  // column names because BaseController inserts validated keys as columns.
  authorization: Joi.object({
    auth_status: Joi.string().valid('Approved', 'Pending', 'Rejected', 'Under Review').required(),
    purpose: Joi.string().min(2).max(255).required(),
    patient_id: Joi.string().uuid().required(),
    provider_id: Joi.string().uuid().required(),
    insurer_id: Joi.string().uuid().required(),
    amount: Joi.number().precision(2).positive().optional(),
    request_date: Joi.string().isoDate().optional()
  }).rename('status', 'auth_status'),
  
  eligibility: Joi.object({
    purpose: Joi.string().min(2).max(255).required(),
    patient_id: Joi.string().uuid().required(),
    provider_id: Joi.string().uuid().required(),
    insurer_id: Joi.string().uuid().required(),
    status: Joi.string().valid('Eligible', 'Not Eligible', 'Pending', 'Under Review').required(),
    coverage: Joi.string().max(50).optional(),
    request_date: Joi.string().isoDate().optional()
  }),
  
  claim: Joi.object({
    claim_number: Joi.string().min(3).max(50).required(),
    patient_id: Joi.string().uuid().required(),
    provider_id: Joi.string().uuid().required(),
    insurer_id: Joi.string().uuid().required(),
    status: Joi.string().valid('Approved', 'Pending', 'Rejected', 'Under Review').required(),
    amount: Joi.number().precision(2).positive().required(),
    submission_date: Joi.string().isoDate().optional()
  }),
  
  // claim_batches (migration 047): SERIAL id, UUID provider/insurer. Claims are attached through
  // POST /claim-batches/create and /:id/add-claims, not through a claim_ids column.
  claimBatch: Joi.object({
    batch_identifier: Joi.string().min(3).max(50).required(),
    provider_id: Joi.string().uuid().required(),
    insurer_id: Joi.string().uuid().required(),
    status: Joi.string().valid('Draft', 'Pending', 'Submitted', 'Queued', 'Processed', 'Partial', 'Rejected', 'Error').optional(),
    total_amount: Joi.number().precision(2).positive().optional(),
    total_claims: Joi.number().integer().min(0).optional(),
    processed_claims: Joi.number().integer().min(0).optional(),
    approved_claims: Joi.number().integer().min(0).optional(),
    rejected_claims: Joi.number().integer().min(0).optional(),
    batch_period_start: Joi.date().optional(),
    batch_period_end: Joi.date().optional(),
    nphies_request_id: Joi.string().max(100).optional(),
    nphies_response_id: Joi.string().max(100).optional(),
    description: Joi.string().optional()
  }).rename('nphies_batch_id', 'nphies_request_id'),
  
  payment: Joi.object({
    payment_ref: Joi.string().min(3).max(50).required(),
    provider_id: Joi.string().uuid().required(),
    insurer_id: Joi.string().uuid().required(),
    amount: Joi.number().precision(2).min(0).required(),
    payment_date: Joi.string().isoDate().required(),
    status: Joi.string().max(50).optional()
  })
    // Accept the newer field names used by some clients. Both amount aliases may be sent together,
    // so multiple renames into `amount` are allowed and total_paid_amount (applied last) wins.
    .rename('payment_ref_number', 'payment_ref', { ignoreUndefined: true })
    .rename('total_amount', 'amount', { ignoreUndefined: true, multiple: true })
    .rename('total_paid_amount', 'amount', { ignoreUndefined: true, multiple: true }),

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
    marital_status: Joi.string().valid('A', 'D', 'I', 'L', 'M', 'P', 'S', 'T', 'W', 'U').allow(null, '').optional(),
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
    // Triage Category codes per NPHIES ValueSet: https://portal.nphies.sa/ig/ValueSet-triage-category.html
    triage_category: Joi.string().valid('IR', 'VU', 'U', 'NU', 'SER').allow(null, '').optional(),
    triage_date: Joi.date().allow(null, '').optional(),
    encounter_priority: Joi.string().valid('EM', 'UR', 'S', 'A', 'R', 'EL', 'CR', 'CS', 'CSP', 'CSR', 'P', 'PRN', 'RR', 'T', 'UD').allow(null, '').optional(),
    emergency_department_disposition: Joi.string().valid('AH', 'NAD', 'NAR', 'DNW', 'LAOR', 'DED', 'DOA', 'R').allow(null, '').optional(),
    
    // Eligibility Response Identifier (per NPHIES Claim-173086)
    eligibility_response_id: Joi.string().max(255).allow(null, '').optional(),
    eligibility_response_system: Joi.string().max(500).allow(null, '').optional(),
    
    // Workflow
    is_update: Joi.boolean().allow(null).optional(),
    related_auth_id: Joi.number().integer().allow(null).optional(),
    // Resubmission - for rejected/partial authorizations being resubmitted
    is_resubmission: Joi.boolean().allow(null).optional(),
    related_claim_identifier: Joi.string().max(255).allow(null, '').optional(),
    is_transfer: Joi.boolean().allow(null).optional(),
    transfer_provider_id: Joi.string().uuid().allow(null, '').optional(),
    transfer_auth_number: Joi.string().max(100).allow(null, '').optional(),
    transfer_period_start: Joi.date().allow(null, '').optional(),
    transfer_period_end: Joi.date().allow(null, '').optional(),
    is_cancelled: Joi.boolean().allow(null).optional(),
    cancellation_reason: Joi.string().allow(null, '').optional(),
    
    // Newborn Extension - per NPHIES Test Case 8
    // Reference: https://portal.nphies.sa/ig/StructureDefinition-extension-newborn.html
    is_newborn: Joi.boolean().allow(null).optional(),
    birth_weight: Joi.number().precision(2).allow(null).optional(), // Weight in grams
    mother_patient_id: Joi.string().uuid().allow(null, '').optional(), // Mother patient ID for newborn requests
    
    // Eligibility Reference
    eligibility_ref: Joi.string().max(100).allow(null, '').optional(),
    eligibility_offline_date: Joi.date().allow(null, '').optional(),
    eligibility_offline_ref: Joi.string().max(255).allow(null, '').optional(),
    
    // Offline Authorization (per NPHIES extension-authorization-offline-date)
    authorization_offline_date: Joi.date().allow(null, '').optional(),
    authorization_offline_reference: Joi.string().max(255).allow(null, '').optional(),
    
    // Clinical
    diagnosis_codes: Joi.string().allow(null, '').optional(),
    primary_diagnosis: Joi.string().max(50).allow(null, '').optional(),
    
    // ICU Hours (for institutional inpatient/daycase)
    icu_hours: Joi.alternatives().try(
      Joi.number().precision(2).min(0),
      Joi.string().allow('', null)
    ).allow(null, '').optional(),

    // Ventilation Hours (NPHIES BV-00731: required for institutional claims with items
    // 13882-00-00, 13882-01-00, 13882-02-00, or 92211-00-00)
    ventilation_hours: Joi.alternatives().try(
      Joi.number().precision(2).min(0),
      Joi.string().allow('', null)
    ).allow(null, '').optional(),
    
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
    
    // AI Medication Safety Analysis (for pharmacy authorizations)
    medication_safety_analysis: Joi.object().allow(null).optional(),
    
    // Drug Interaction Justification (when proceeding despite safety warnings)
    drug_interaction_justification: Joi.string().allow(null, '').optional(),
    drug_interaction_justification_date: Joi.date().allow(null, '').optional(),
    
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
      is_package: Joi.boolean().allow(null).optional(),
      is_maternity: Joi.boolean().allow(null).optional(),
      tax: Joi.number().precision(2).allow(null).optional(),
      factor: Joi.number().precision(4).allow(null).optional(),
      diagnosis_sequences: Joi.array().items(Joi.number().integer()).allow(null).optional(),
      information_sequences: Joi.array().items(Joi.number().integer()).allow(null).optional(),
      // Medication fields (for pharmacy items)
      medication_name: Joi.string().max(255).allow(null, '').optional(),
      service_description: Joi.string().max(500).allow(null, '').optional(),
      // Shadow billing (dual coding) fields - for unlisted/non-standard codes
      shadow_code: Joi.string().max(50).allow(null, '').optional(),
      shadow_code_system: Joi.string().max(255).allow(null, '').optional(),
      shadow_code_display: Joi.string().max(255).allow(null, '').optional()
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
      category: Joi.string().max(50).allow(null, '').optional(),
      // Fields for linking to supportingInfo (frontend-only, filtered before save)
      supporting_info_sequence: Joi.alternatives().try(Joi.number().integer(), Joi.string().allow('', null)).allow(null, '').optional(),
      supporting_info_id: Joi.number().integer().allow(null).optional(),
      supporting_info_index: Joi.number().integer().allow(null).optional(),
      // Frontend-only fields (filtered before save)
      id: Joi.string().allow(null, '').optional(),
      uploadedAt: Joi.string().allow(null, '').optional(),
      binary_id: Joi.string().max(100).allow(null, '').optional()
    }).unknown(true)).optional(), // Allow unknown fields to be filtered out
    
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
    }).allow(null).optional().custom((value, helpers) => {
      if (!value || value.product_type !== 'lens') return value;
      const hasRightEye = value.right_eye && Object.values(value.right_eye).some(v => v !== '' && v !== null && v !== undefined);
      const hasLeftEye = value.left_eye && Object.values(value.left_eye).some(v => v !== '' && v !== null && v !== undefined);
      const isSphereEmpty = (eye) => eye?.sphere === '' || eye?.sphere === null || eye?.sphere === undefined;
      if (hasRightEye && isSphereEmpty(value.right_eye)) {
        return helpers.error('any.custom', { message: 'Sphere (SPH) is required for right eye when product type is lens (NPHIES IC-01417)' });
      }
      if (hasLeftEye && isSphereEmpty(value.left_eye)) {
        return helpers.error('any.custom', { message: 'Sphere (SPH) is required for left eye when product type is lens (NPHIES IC-01417)' });
      }
      return value;
    }),
    
    // Lab Observations for Professional claims (LOINC codes for Observation resources)
    // Per NPHIES IG: Lab test details MUST be in Observation resources, NOT Claim.item.productOrService
    // These are referenced via Claim.supportingInfo with category = "laboratory"
    lab_observations: Joi.array().items(Joi.object({
      sequence: Joi.number().integer().min(1).required(),
      loinc_code: Joi.string().max(50).allow(null, '').optional(),
      loinc_display: Joi.string().max(255).allow(null, '').optional(),
      test_name: Joi.string().max(255).allow(null, '').optional(),
      value: Joi.alternatives().try(
        Joi.string().allow(null, ''),
        Joi.number()
      ).optional(),
      value_type: Joi.string().valid('quantity', 'string').allow(null, '').optional(),
      unit: Joi.string().max(50).allow(null, '').optional(),
      unit_code: Joi.string().max(50).allow(null, '').optional(),
      status: Joi.string().valid('registered', 'preliminary', 'final', 'amended', 'cancelled').allow(null, '').optional(),
      effective_date: Joi.alternatives().try(
        Joi.date(),
        Joi.string().allow(null, '')
      ).optional(),
      note: Joi.string().allow(null, '').optional(),
      // Keep these for backwards compatibility
      value_quantity: Joi.number().precision(4).allow(null).optional(),
      value_quantity_unit: Joi.string().max(50).allow(null, '').optional(),
      value_string: Joi.string().allow(null, '').optional(),
      interpretation: Joi.string().max(50).allow(null, '').optional(),
      notes: Joi.string().allow(null, '').optional()
    })).optional()
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
    triage_category: Joi.string().valid('IR', 'VU', 'U', 'NU', 'SER').allow(null, '').optional(),
    triage_date: Joi.date().allow(null, '').optional(),
    encounter_priority: Joi.string().valid('EM', 'UR', 'S', 'A', 'R', 'EL', 'CR', 'CS', 'CSP', 'CSR', 'P', 'PRN', 'RR', 'T', 'UD').allow(null, '').optional(),
    emergency_department_disposition: Joi.string().valid('AH', 'NAD', 'NAR', 'DNW', 'LAOR', 'DED', 'DOA', 'R').allow(null, '').optional(),
    
    // Eligibility Reference
    eligibility_ref: Joi.string().max(100).allow(null, '').optional(),
    eligibility_offline_date: Joi.date().allow(null, '').optional(),
    eligibility_offline_ref: Joi.string().max(255).allow(null, '').optional(),
    
    // Offline Authorization (per NPHIES extension-authorization-offline-date)
    authorization_offline_date: Joi.date().allow(null, '').optional(),
    authorization_offline_reference: Joi.string().max(255).allow(null, '').optional(),
    
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
    })).optional(),

    // Vision Prescription (copied from prior auth for vision claims)
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
    }).allow(null).optional().custom((value, helpers) => {
      if (!value || value.product_type !== 'lens') return value;
      const hasRightEye = value.right_eye && Object.values(value.right_eye).some(v => v !== '' && v !== null && v !== undefined);
      const hasLeftEye = value.left_eye && Object.values(value.left_eye).some(v => v !== '' && v !== null && v !== undefined);
      const isSphereEmpty = (eye) => eye?.sphere === '' || eye?.sphere === null || eye?.sphere === undefined;
      if (hasRightEye && isSphereEmpty(value.right_eye)) {
        return helpers.error('any.custom', { message: 'Sphere (SPH) is required for right eye when product type is lens (NPHIES IC-01417)' });
      }
      if (hasLeftEye && isSphereEmpty(value.left_eye)) {
        return helpers.error('any.custom', { message: 'Sphere (SPH) is required for left eye when product type is lens (NPHIES IC-01417)' });
      }
      return value;
    }),

    // AI Medication Safety Analysis (copied from prior auth for pharmacy claims)
    medication_safety_analysis: Joi.object().allow(null).optional(),
    drug_interaction_justification: Joi.string().allow(null, '').optional(),
    drug_interaction_justification_date: Joi.date().allow(null, '').optional()
  })
};

// Note: QUERY_PATTERNS have been moved to /db/queries.js for centralized management
