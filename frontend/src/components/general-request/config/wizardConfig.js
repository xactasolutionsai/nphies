/**
 * Wizard Configuration
 * Defines steps, required fields, and navigation rules for the General Request Wizard
 */

export const WIZARD_STEPS = [
  {
    id: 1,
    name: 'Patient Info',
    description: 'Patient demographics and vitals',
    requiredFields: [
      'patient.fullName',
      'patient.idNumber',
      'patient.dob',
      'patient.gender'
    ]
  },
  {
    id: 2,
    name: 'Coverage',
    description: 'Insurance and coverage details',
    requiredFields: [
      'coverage.insurer',
      'coverage.policyNumber'
    ]
  },
  {
    id: 3,
    name: 'Provider',
    description: 'Provider and facility information',
    requiredFields: [
      'provider.facilityName',
      'provider.doctorName',
      'provider.licenseNumber'
    ]
  },
  {
    id: 4,
    name: 'Service Request',
    description: 'Service details and clinical information',
    requiredFields: [
      'service.diagnosis',
      'service.description',
      'service.bodyPart'
    ]
  },
  {
    id: 5,
    name: 'AI Check',
    description: 'Review and validate your request',
    requiredFields: [] // Validation happens here
  },
  {
    id: 6,
    name: 'Medications',
    description: 'Prescribed medications',
    requiredFields: [] // Optional step
  }
];

// Service description options (scan types)
export const SERVICE_DESCRIPTIONS = [
  { value: 'X-Ray', label: 'X-Ray' },
  { value: 'CT Scan', label: 'CT Scan' },
  { value: 'MRI', label: 'MRI' },
  { value: 'Ultrasound', label: 'Ultrasound' },
  { value: 'PET Scan', label: 'PET Scan' },
  { value: 'Mammogram', label: 'Mammogram' },
  { value: 'Bone Scan', label: 'Bone Scan' },
  { value: 'Fluoroscopy', label: 'Fluoroscopy' },
  { value: 'Angiography', label: 'Angiography' },
  { value: 'Nuclear Medicine', label: 'Nuclear Medicine' }
];

// Body part options
export const BODY_PARTS = [
  { value: 'Head', label: 'Head' },
  { value: 'Brain', label: 'Brain' },
  { value: 'Neck', label: 'Neck' },
  { value: 'Chest', label: 'Chest' },
  { value: 'Abdomen', label: 'Abdomen' },
  { value: 'Pelvis', label: 'Pelvis' },
  { value: 'Spine', label: 'Spine' },
  { value: 'Upper Limb', label: 'Upper Limb' },
  { value: 'Lower Limb', label: 'Lower Limb' },
  { value: 'Shoulder', label: 'Shoulder' },
  { value: 'Elbow', label: 'Elbow' },
  { value: 'Wrist', label: 'Wrist' },
  { value: 'Hand', label: 'Hand' },
  { value: 'Hip', label: 'Hip' },
  { value: 'Knee', label: 'Knee' },
  { value: 'Ankle', label: 'Ankle' },
  { value: 'Foot', label: 'Foot' },
  { value: 'Heart', label: 'Heart' },
  { value: 'Lungs', label: 'Lungs' },
  { value: 'Liver', label: 'Liver' },
  { value: 'Kidney', label: 'Kidney' },
  { value: 'Bladder', label: 'Bladder' },
  { value: 'Other', label: 'Other' }
];

// Laterality options
export const LATERALITY_OPTIONS = [
  { value: 'left', label: 'Left' },
  { value: 'right', label: 'Right' },
  { value: 'bilateral', label: 'Bilateral' },
  { value: 'n/a', label: 'N/A' }
];

// Urgency options
export const URGENCY_OPTIONS = [
  { value: 'routine', label: 'Routine' },
  { value: 'urgent', label: 'Urgent' },
  { value: 'emergency', label: 'Emergency' },
  { value: 'asap', label: 'ASAP' }
];

// Gender options
export const GENDER_OPTIONS = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'other', label: 'Other' },
  { value: 'unknown', label: 'Unknown' }
];

// Marital status options (HL7 v3-MaritalStatus codes)
export const MARITAL_STATUS_OPTIONS = [
  { value: 'S', label: 'S - Never Married (Single)' },
  { value: 'M', label: 'M - Married' },
  { value: 'D', label: 'D - Divorced' },
  { value: 'W', label: 'W - Widowed' },
  { value: 'A', label: 'A - Annulled' },
  { value: 'I', label: 'I - Interlocutory' },
  { value: 'L', label: 'L - Legally Separated' },
  { value: 'P', label: 'P - Polygamous' },
  { value: 'T', label: 'T - Domestic Partner' },
  { value: 'U', label: 'U - Unknown' }
];

// Encounter class options
export const ENCOUNTER_CLASS_OPTIONS = [
  { value: 'outpatient', label: 'Outpatient' },
  { value: 'inpatient', label: 'Inpatient' },
  { value: 'emergency', label: 'Emergency' },
  { value: 'daycare', label: 'Day Care' }
];

// Coverage type options
export const COVERAGE_TYPE_OPTIONS = [
  { value: 'Primary', label: 'Primary' },
  { value: 'Secondary', label: 'Secondary' },
  { value: 'TPA', label: 'TPA (Third Party Administrator)' },
  { value: 'Self-Pay', label: 'Self-Pay' }
];

// Emergency care level options
export const EMERGENCY_CARE_LEVEL_OPTIONS = [
  { value: 'Level 1', label: 'Level 1 - Critical' },
  { value: 'Level 2', label: 'Level 2 - Emergency' },
  { value: 'Level 3', label: 'Level 3 - Urgent' },
  { value: 'Level 4', label: 'Level 4 - Semi-Urgent' },
  { value: 'Level 5', label: 'Level 5 - Non-Urgent' }
];

// Plan type options
export const PLAN_TYPE_OPTIONS = [
  { value: 'Individual', label: 'Individual' },
  { value: 'Family', label: 'Family' },
  { value: 'Group', label: 'Group' },
  { value: 'Corporate', label: 'Corporate' }
];

/**
 * Get step by ID
 */
export const getStepById = (stepId) => {
  return WIZARD_STEPS.find(step => step.id === stepId);
};

/**
 * Get next step ID
 */
export const getNextStepId = (currentStepId) => {
  const currentIndex = WIZARD_STEPS.findIndex(step => step.id === currentStepId);
  if (currentIndex === -1 || currentIndex === WIZARD_STEPS.length - 1) {
    return null;
  }
  return WIZARD_STEPS[currentIndex + 1].id;
};

/**
 * Get previous step ID
 */
export const getPrevStepId = (currentStepId) => {
  const currentIndex = WIZARD_STEPS.findIndex(step => step.id === currentStepId);
  if (currentIndex <= 0) {
    return null;
  }
  return WIZARD_STEPS[currentIndex - 1].id;
};

/**
 * Check if step is first
 */
export const isFirstStep = (stepId) => {
  return stepId === WIZARD_STEPS[0].id;
};

/**
 * Check if step is last
 */
export const isLastStep = (stepId) => {
  return stepId === WIZARD_STEPS[WIZARD_STEPS.length - 1].id;
};

