// Dummy Data Generator for Vitals & Clinical Tab
// Generates randomized, realistic medical data based on auth type and encounter class

import { DENTAL_CHIEF_COMPLAINT_OPTIONS, INVESTIGATION_RESULT_OPTIONS } from './constants';

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Generate a random number within a range (inclusive)
 */
const randomInRange = (min, max, decimals = 0) => {
  const value = Math.random() * (max - min) + min;
  return decimals > 0 ? parseFloat(value.toFixed(decimals)) : Math.round(value);
};

/**
 * Pick a random item from an array
 */
const randomPick = (array) => array[Math.floor(Math.random() * array.length)];

// ============================================================================
// VITAL SIGNS RANGES (Realistic medical ranges)
// ============================================================================

const VITAL_RANGES = {
  systolic: { min: 110, max: 140, decimals: 0 },
  diastolic: { min: 70, max: 90, decimals: 0 },
  height: { min: 155, max: 190, decimals: 0 },
  weight: { min: 55, max: 95, decimals: 1 },
  pulse: { min: 60, max: 100, decimals: 0 },
  temperature: { min: 36.5, max: 37.5, decimals: 1 },
  oxygen_saturation: { min: 95, max: 100, decimals: 0 },
  respiratory_rate: { min: 12, max: 20, decimals: 0 }
};

/**
 * Generate a random vital sign value
 */
const generateVital = (key) => {
  const range = VITAL_RANGES[key];
  if (!range) return '';
  return String(randomInRange(range.min, range.max, range.decimals));
};

// ============================================================================
// CHIEF COMPLAINT OPTIONS BY AUTH TYPE
// ============================================================================

// General/Institutional chief complaints (SNOMED codes)
const INSTITUTIONAL_CHIEF_COMPLAINTS = [
  { code: '21522001', display: 'Abdominal pain' },
  { code: '25064002', display: 'Headache' },
  { code: '267036007', display: 'Dyspnea (shortness of breath)' },
  { code: '29857009', display: 'Chest pain' },
  { code: '386661006', display: 'Fever' },
  { code: '422587007', display: 'Nausea' },
  { code: '422400008', display: 'Vomiting' },
  { code: '62315008', display: 'Diarrhea' },
  { code: '271807003', display: 'Eruption of skin' },
  { code: '68962001', display: 'Muscle pain' }
];

// Professional/Outpatient chief complaints
const PROFESSIONAL_CHIEF_COMPLAINTS = [
  { code: '25064002', display: 'Headache' },
  { code: '267036007', display: 'Dyspnea' },
  { code: '386661006', display: 'Fever' },
  { code: '49727002', display: 'Cough' },
  { code: '162397003', display: 'Sore throat' },
  { code: '271807003', display: 'Skin rash' },
  { code: '68962001', display: 'Muscle pain' },
  { code: '84229001', display: 'Fatigue' },
  { code: '422587007', display: 'Nausea' },
  { code: '279079003', display: 'Nasal congestion' }
];

// Pharmacy chief complaints (medication-related)
const PHARMACY_CHIEF_COMPLAINTS = [
  { code: '386661006', display: 'Fever' },
  { code: '25064002', display: 'Headache' },
  { code: '49727002', display: 'Cough' },
  { code: '21522001', display: 'Abdominal pain' },
  { code: '267036007', display: 'Dyspnea' },
  { code: '68962001', display: 'Muscle pain' },
  { code: '422587007', display: 'Nausea' },
  { code: '84229001', display: 'Fatigue' }
];

// Vision chief complaints
const VISION_CHIEF_COMPLAINTS = [
  { code: '246636008', display: 'Blurred vision' },
  { code: '60862001', display: 'Tinnitus' },
  { code: '193570009', display: 'Cataract' },
  { code: '23986001', display: 'Glaucoma' },
  { code: '246655008', display: 'Eye pain' },
  { code: '703630003', display: 'Red eye' },
  { code: '418107008', display: 'Dry eye syndrome' },
  { code: '422256009', display: 'Floaters' },
  { code: '131195008', display: 'Photophobia' },
  { code: '24010005', display: 'Double vision' }
];

// ============================================================================
// CLINICAL TEXT TEMPLATES BY AUTH TYPE
// ============================================================================

const PATIENT_HISTORY_TEMPLATES = {
  institutional: [
    'Patient has a history of hypertension controlled with medication. No known drug allergies. Previous appendectomy in 2018.',
    'Known diabetic (Type 2) on oral hypoglycemics. History of mild asthma. Allergic to penicillin.',
    'No significant past medical history. Non-smoker, occasional alcohol use. No known allergies.',
    'History of coronary artery disease with stent placement 2020. On antiplatelet therapy. NKDA.',
    'Chronic kidney disease stage 3. Hypertension. History of gout. Allergic to sulfa drugs.'
  ],
  professional: [
    'Generally healthy patient with no significant medical history. No known allergies.',
    'History of seasonal allergies. Takes over-the-counter antihistamines as needed.',
    'Mild hypertension controlled with diet and exercise. No medications. NKDA.',
    'History of migraine headaches. Takes sumatriptan as needed. No other medical issues.',
    'Previous history of anxiety disorder, currently well controlled. No known drug allergies.'
  ],
  pharmacy: [
    'Patient on regular medications for hypertension and diabetes. Compliant with treatment.',
    'No significant medical history. First time prescription for this condition.',
    'Chronic pain patient on regular analgesics. Requesting refill of current medications.',
    'Asthmatic patient requiring maintenance inhaler refill. Well controlled on current regimen.',
    'Diabetic patient requiring insulin supplies and glucose monitoring equipment.'
  ],
  dental: [
    'Patient reports good oral hygiene habits. Last dental visit 6 months ago. No known allergies.',
    'History of dental anxiety. Previous root canal treatment on tooth 36. NKDA.',
    'Diabetic patient - blood sugar well controlled. On anticoagulation therapy.',
    'No significant dental history. First visit to this practice. No known allergies.',
    'History of periodontal disease. Regular 3-month recall patient. Allergic to latex.'
  ],
  vision: [
    'Patient wears corrective lenses for myopia. Last eye exam 1 year ago. No known allergies.',
    'History of dry eye syndrome. Uses artificial tears regularly. No other eye conditions.',
    'Diabetic patient - requires annual diabetic retinopathy screening. Well controlled.',
    'Family history of glaucoma. Previous LASIK surgery in 2019. No complications.',
    'Contact lens wearer for 10 years. No history of eye infections. NKDA.'
  ]
};

const HISTORY_OF_PRESENT_ILLNESS_TEMPLATES = {
  institutional: [
    'Patient presents with 3-day history of progressive abdominal pain, localized to RLQ. Associated with low-grade fever and decreased appetite. No vomiting or diarrhea.',
    'Acute onset chest pain started 2 hours ago. Described as pressure-like, radiating to left arm. Associated with diaphoresis and shortness of breath.',
    'Progressive shortness of breath over 1 week. Worse with exertion. Associated with bilateral leg swelling and orthopnea.',
    'Sudden onset severe headache described as "worst headache of life". Associated with neck stiffness and photophobia.',
    'Fall from standing height 6 hours ago. Unable to bear weight on right leg. Obvious deformity of right hip.'
  ],
  professional: [
    'Patient reports 5-day history of productive cough with yellow sputum. Low-grade fever. No shortness of breath at rest.',
    'Gradual onset headache over 2 weeks. Bilateral, frontal location. Worse in mornings. No visual changes.',
    'Intermittent joint pain in both knees for 3 months. Worse with activity, better with rest. Morning stiffness < 30 minutes.',
    'Skin rash appeared 3 days ago. Started on trunk, spreading to extremities. Mild itching. No fever.',
    'Fatigue and malaise for 2 weeks. Difficulty concentrating. Sleep disturbance. No weight changes.'
  ],
  pharmacy: [
    'Patient requires continuation of current antihypertensive regimen. Blood pressure well controlled on current medications.',
    'Requesting refill of maintenance diabetes medications. Recent HbA1c 6.8%. No hypoglycemic episodes.',
    'Acute upper respiratory infection. Symptoms for 5 days. Requesting symptomatic treatment.',
    'Chronic pain management. Current regimen effective. No adverse effects reported.',
    'Seasonal allergies flare-up. Previous antihistamine effective. Requesting same medication.'
  ],
  dental: [
    'Patient presents with tooth pain in lower right quadrant for 2 days. Pain is sharp, worse with cold. No swelling.',
    'Routine check-up visit. No current complaints. Last cleaning was 6 months ago.',
    'Broken filling noticed 1 week ago. No pain currently. Sensitivity to cold occasionally.',
    'Bleeding gums noticed while brushing for past 2 weeks. No pain. Gums appear swollen.',
    'Wisdom tooth pain in lower left for 1 week. Difficulty opening mouth fully. Mild swelling.'
  ],
  vision: [
    'Patient reports gradual decrease in vision over 6 months. More noticeable when reading. No pain or redness.',
    'Sudden onset of floaters in right eye 2 days ago. Occasional flashes of light. No vision loss.',
    'Routine eye examination for glasses prescription update. Current glasses are 2 years old.',
    'Red, itchy eyes for 1 week. Watery discharge. No vision changes. Both eyes affected.',
    'Difficulty with night driving. Glare from oncoming headlights. Gradual onset over 1 year.'
  ]
};

const PHYSICAL_EXAMINATION_TEMPLATES = {
  institutional: [
    'Vitals stable. Alert and oriented x3. Abdomen: soft, tender RLQ with rebound. Positive McBurney point. Bowel sounds hypoactive.',
    'Appears distressed. Diaphoretic. Heart: regular rhythm, no murmurs. Lungs: bilateral crackles at bases. JVD present.',
    'Respiratory distress at rest. O2 sat 88% on room air. Bilateral pitting edema to knees. S3 gallop present.',
    'GCS 15. Neck stiffness present. Positive Kernig and Brudzinski signs. Pupils equal and reactive.',
    'Right hip externally rotated and shortened. Unable to perform ROM. Neurovascular intact distally.'
  ],
  professional: [
    'Vitals within normal limits. Pharynx erythematous with tonsillar exudate. Cervical lymphadenopathy present. Lungs clear.',
    'Afebrile. Alert and oriented. No meningeal signs. Cranial nerves intact. No focal neurological deficits.',
    'Both knees with mild crepitus on ROM. No effusion. Full ROM bilaterally. Stable ligaments.',
    'Maculopapular rash on trunk and extremities. No vesicles. No mucosal involvement. Afebrile.',
    'General appearance: tired but well-nourished. Thyroid normal. No lymphadenopathy. Heart and lungs normal.'
  ],
  pharmacy: [
    'Blood pressure 128/82 mmHg. Heart rate 72 bpm regular. Patient appears well.',
    'Weight stable. Blood glucose 126 mg/dL fasting. No signs of hypoglycemia.',
    'Mild nasal congestion. Throat slightly erythematous. Lungs clear. No fever.',
    'Chronic pain assessment: pain level 4/10 on current regimen. Functional status improved.',
    'Mild allergic rhinitis. Clear nasal discharge. No respiratory distress.'
  ],
  dental: [
    'Extraoral: No swelling or asymmetry. TMJ: normal ROM, no clicking. Intraoral: Caries noted on tooth 46.',
    'Oral hygiene fair. Mild gingivitis generalized. No active caries. Calculus present.',
    'Fractured restoration on tooth 36. Tooth vital. No periapical pathology on percussion.',
    'Gingival erythema and edema. Probing depths 4-5mm in posterior. Bleeding on probing.',
    'Partially erupted 38 with pericoronitis. Swelling and erythema of operculum. Trismus present.'
  ],
  vision: [
    'Visual acuity: OD 20/40, OS 20/30. Pupils equal and reactive. No RAPD. IOP: OD 16, OS 15.',
    'Dilated fundus exam: clear media, cup-to-disc ratio 0.3 OU. No retinal pathology.',
    'Slit lamp: mild nuclear sclerosis OU. Anterior chamber deep and quiet. No iris abnormalities.',
    'External exam: mild conjunctival injection OU. No discharge. Cornea clear. Tear film reduced.',
    'Visual fields full to confrontation. Extraocular movements intact. No nystagmus.'
  ]
};

const TREATMENT_PLAN_TEMPLATES = {
  institutional: [
    'Admit for observation. NPO. IV fluids. Surgical consultation for possible appendectomy. Serial abdominal exams.',
    'Admit to CCU. Cardiac enzymes q8h. Continuous telemetry. Cardiology consultation. Consider cardiac catheterization.',
    'Admit for CHF exacerbation. IV diuretics. Fluid restriction. Daily weights. Echocardiogram.',
    'Emergent CT head. Lumbar puncture if CT negative. Neurosurgery consultation. ICU admission.',
    'Orthopedic consultation. Hip X-ray and CT. Pain management. DVT prophylaxis. Plan for surgical fixation.'
  ],
  professional: [
    'Symptomatic treatment with antipyretics and rest. Throat culture. Follow up in 3 days if no improvement.',
    'Trial of tension headache prophylaxis. Keep headache diary. Return in 4 weeks for reassessment.',
    'Conservative management with NSAIDs and physical therapy. X-rays of knees. Follow up in 6 weeks.',
    'Topical corticosteroid for 1 week. Antihistamine for itching. Return if worsening or no improvement.',
    'Thyroid function tests and CBC. Sleep hygiene counseling. Follow up with results in 1 week.'
  ],
  pharmacy: [
    'Continue current antihypertensive regimen. 90-day supply authorized. Follow up with PCP in 3 months.',
    'Refill diabetes medications as requested. Continue glucose monitoring. HbA1c in 3 months.',
    'Symptomatic treatment: decongestant and cough suppressant for 7 days. Rest and hydration.',
    'Continue current pain management regimen. No changes indicated. Review in 1 month.',
    'Antihistamine for allergic rhinitis. Use as needed during allergy season. Refill authorized.'
  ],
  dental: [
    'Composite restoration on tooth 46. Local anesthesia. Post-op instructions provided. Review in 2 weeks.',
    'Scaling and root planing. Oral hygiene instructions. Chlorhexidine rinse. Recall in 3 months.',
    'Replace failed restoration on tooth 36. Assess for crown if recurrent. Follow up in 1 week.',
    'Deep cleaning with local anesthesia. Periodontal maintenance program. Recall in 3 months.',
    'Antibiotics for pericoronitis. Warm salt water rinses. Plan extraction of 38 when acute phase resolves.'
  ],
  vision: [
    'New glasses prescription provided. Recommend polycarbonate lenses with AR coating. Return in 1 year.',
    'Urgent retinal evaluation. Possible posterior vitreous detachment. Follow up in 1 week.',
    'Cataract surgery discussed. Pre-operative measurements scheduled. Surgery in 4 weeks.',
    'Artificial tears QID. Warm compresses BID. Omega-3 supplements. Follow up in 1 month.',
    'Refer for cataract evaluation. Continue current glasses. Night driving precautions discussed.'
  ]
};

// ============================================================================
// MAIN GENERATOR FUNCTION
// ============================================================================

/**
 * Generate dummy vitals and clinical data based on auth type and encounter class
 * @param {string} authType - The authorization type (institutional, professional, pharmacy, dental, vision)
 * @param {string} encounterClass - The encounter class (inpatient, outpatient, daycase, etc.)
 * @returns {Object} - Object containing vital_signs, clinical_info, and admission_info
 */
export const generateDummyVitalsAndClinical = (authType, encounterClass) => {
  const result = {
    vital_signs: {
      systolic: '',
      diastolic: '',
      height: '',
      weight: '',
      pulse: '',
      temperature: '',
      oxygen_saturation: '',
      respiratory_rate: '',
      measurement_time: new Date().toISOString()
    },
    clinical_info: {
      chief_complaint_format: 'snomed',
      chief_complaint_code: '',
      chief_complaint_display: '',
      chief_complaint_text: '',
      patient_history: '',
      history_of_present_illness: '',
      physical_examination: '',
      treatment_plan: '',
      investigation_result: ''
    },
    admission_info: {
      admission_weight: '',
      estimated_length_of_stay: ''
    }
  };

  // Generate vitals based on auth type requirements
  switch (authType) {
    case 'institutional':
      // All vitals required for institutional
      result.vital_signs.systolic = generateVital('systolic');
      result.vital_signs.diastolic = generateVital('diastolic');
      result.vital_signs.height = generateVital('height');
      result.vital_signs.weight = generateVital('weight');
      result.vital_signs.pulse = generateVital('pulse');
      result.vital_signs.temperature = generateVital('temperature');
      result.vital_signs.oxygen_saturation = generateVital('oxygen_saturation');
      result.vital_signs.respiratory_rate = generateVital('respiratory_rate');
      break;

    case 'professional':
      // BP, pulse, temp for professional
      result.vital_signs.systolic = generateVital('systolic');
      result.vital_signs.diastolic = generateVital('diastolic');
      result.vital_signs.pulse = generateVital('pulse');
      result.vital_signs.temperature = generateVital('temperature');
      result.vital_signs.height = generateVital('height');
      result.vital_signs.weight = generateVital('weight');
      break;

    case 'pharmacy':
      // Weight for dosing calculations
      result.vital_signs.weight = generateVital('weight');
      result.vital_signs.height = generateVital('height');
      result.vital_signs.systolic = generateVital('systolic');
      result.vital_signs.diastolic = generateVital('diastolic');
      break;

    case 'dental':
      // BP, pulse for dental
      result.vital_signs.systolic = generateVital('systolic');
      result.vital_signs.diastolic = generateVital('diastolic');
      result.vital_signs.pulse = generateVital('pulse');
      break;

    case 'vision':
      // Basic BP for vision
      result.vital_signs.systolic = generateVital('systolic');
      result.vital_signs.diastolic = generateVital('diastolic');
      break;

    default:
      // Default: basic vitals
      result.vital_signs.systolic = generateVital('systolic');
      result.vital_signs.diastolic = generateVital('diastolic');
      result.vital_signs.pulse = generateVital('pulse');
  }

  // Generate chief complaint based on auth type
  let chiefComplaint;
  if (authType === 'dental') {
    // Use dental-specific SNOMED codes (excluding 'other')
    const dentalOptions = DENTAL_CHIEF_COMPLAINT_OPTIONS.filter(opt => opt.value !== 'other');
    const selected = randomPick(dentalOptions);
    result.clinical_info.chief_complaint_format = 'snomed';
    result.clinical_info.chief_complaint_code = selected.value;
    result.clinical_info.chief_complaint_display = selected.label.split(' - ')[1] || selected.label;
  } else if (authType === 'vision') {
    chiefComplaint = randomPick(VISION_CHIEF_COMPLAINTS);
    result.clinical_info.chief_complaint_format = 'snomed';
    result.clinical_info.chief_complaint_code = chiefComplaint.code;
    result.clinical_info.chief_complaint_display = chiefComplaint.display;
  } else if (authType === 'pharmacy') {
    chiefComplaint = randomPick(PHARMACY_CHIEF_COMPLAINTS);
    result.clinical_info.chief_complaint_format = 'snomed';
    result.clinical_info.chief_complaint_code = chiefComplaint.code;
    result.clinical_info.chief_complaint_display = chiefComplaint.display;
  } else if (authType === 'institutional') {
    chiefComplaint = randomPick(INSTITUTIONAL_CHIEF_COMPLAINTS);
    result.clinical_info.chief_complaint_format = 'snomed';
    result.clinical_info.chief_complaint_code = chiefComplaint.code;
    result.clinical_info.chief_complaint_display = chiefComplaint.display;
  } else {
    chiefComplaint = randomPick(PROFESSIONAL_CHIEF_COMPLAINTS);
    result.clinical_info.chief_complaint_format = 'snomed';
    result.clinical_info.chief_complaint_code = chiefComplaint.code;
    result.clinical_info.chief_complaint_display = chiefComplaint.display;
  }

  // Generate clinical text based on auth type
  const type = authType || 'professional';
  const historyTemplates = PATIENT_HISTORY_TEMPLATES[type] || PATIENT_HISTORY_TEMPLATES.professional;
  const hpiTemplates = HISTORY_OF_PRESENT_ILLNESS_TEMPLATES[type] || HISTORY_OF_PRESENT_ILLNESS_TEMPLATES.professional;
  const examTemplates = PHYSICAL_EXAMINATION_TEMPLATES[type] || PHYSICAL_EXAMINATION_TEMPLATES.professional;
  const planTemplates = TREATMENT_PLAN_TEMPLATES[type] || TREATMENT_PLAN_TEMPLATES.professional;

  // Fill clinical info based on auth type requirements
  switch (authType) {
    case 'institutional':
      // Full clinical info for institutional
      result.clinical_info.patient_history = randomPick(historyTemplates);
      result.clinical_info.history_of_present_illness = randomPick(hpiTemplates);
      result.clinical_info.physical_examination = randomPick(examTemplates);
      result.clinical_info.treatment_plan = randomPick(planTemplates);
      result.clinical_info.investigation_result = randomPick(
        INVESTIGATION_RESULT_OPTIONS.filter(opt => opt.value !== 'other')
      ).value;
      break;

    case 'professional':
      // Chief complaint, HPI for professional
      result.clinical_info.patient_history = randomPick(historyTemplates);
      result.clinical_info.history_of_present_illness = randomPick(hpiTemplates);
      result.clinical_info.physical_examination = randomPick(examTemplates);
      result.clinical_info.treatment_plan = randomPick(planTemplates);
      break;

    case 'pharmacy':
      // Minimal clinical info for pharmacy
      result.clinical_info.history_of_present_illness = randomPick(hpiTemplates);
      result.clinical_info.treatment_plan = randomPick(planTemplates);
      break;

    case 'dental':
      // Dental-specific clinical info
      result.clinical_info.patient_history = randomPick(historyTemplates);
      result.clinical_info.history_of_present_illness = randomPick(hpiTemplates);
      result.clinical_info.physical_examination = randomPick(examTemplates);
      result.clinical_info.treatment_plan = randomPick(planTemplates);
      break;

    case 'vision':
      // Vision-specific clinical info
      result.clinical_info.patient_history = randomPick(historyTemplates);
      result.clinical_info.history_of_present_illness = randomPick(hpiTemplates);
      result.clinical_info.physical_examination = randomPick(examTemplates);
      result.clinical_info.treatment_plan = randomPick(planTemplates);
      break;

    default:
      result.clinical_info.history_of_present_illness = randomPick(hpiTemplates);
  }

  // Generate admission info for inpatient/daycase encounters
  if (['inpatient', 'daycase'].includes(encounterClass)) {
    result.admission_info.admission_weight = result.vital_signs.weight || generateVital('weight');
    result.admission_info.estimated_length_of_stay = String(randomInRange(1, 7, 0));
  }

  return result;
};

export default generateDummyVitalsAndClinical;

