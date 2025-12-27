// Dropdown options for Prior Authorization Form

export const AUTH_TYPE_OPTIONS = [
  { value: 'institutional', label: 'Institutional' },
  { value: 'professional', label: 'Professional' },
  { value: 'pharmacy', label: 'Pharmacy' },
  { value: 'dental', label: 'Dental' },
  { value: 'vision', label: 'Vision' }
];

export const PRIORITY_OPTIONS = [
  { value: 'stat', label: 'STAT (Urgent)' },
  { value: 'normal', label: 'Normal' },
  { value: 'deferred', label: 'Deferred' }
];

// Claim SubType options per NPHIES
// Reference: http://nphies.sa/terminology/CodeSystem/claim-subtype
export const CLAIM_SUBTYPE_OPTIONS = [
  { value: 'op', label: 'OutPatient (OP)' },
  { value: 'ip', label: 'Inpatient (IP)' },
  { value: 'emr', label: 'Emergency (EMR)' }
];

// Allowed claim subtypes by auth type
// Reference: NPHIES IG - claim type and subtype combinations
export const ALLOWED_CLAIM_SUBTYPES = {
  // Institutional: Can use IP (inpatient) or OP (outpatient)
  institutional: ['ip', 'op'],
  
  // Professional: Can use OP (outpatient) or EMR (emergency)
  professional: ['op', 'emr'],
  
  // Pharmacy: Only OP (outpatient) per NPHIES example Claim-483074
  pharmacy: ['op'],
  
  // Dental (Oral): Only OP (outpatient)
  dental: ['op'],
  
  // Vision: Only OP (outpatient)
  vision: ['op']
};

// Helper function to get filtered claim subtype options based on auth type
export const getClaimSubtypeOptions = (authType) => {
  const allowed = ALLOWED_CLAIM_SUBTYPES[authType] || ALLOWED_CLAIM_SUBTYPES.professional;
  return CLAIM_SUBTYPE_OPTIONS.map(option => ({
    ...option,
    isDisabled: !allowed.includes(option.value)
  }));
};

export const ENCOUNTER_CLASS_OPTIONS = [
  { value: 'inpatient', label: 'Inpatient (IMP)' },
  { value: 'outpatient', label: 'Outpatient' },
  { value: 'ambulatory', label: 'Ambulatory (AMB)' },
  { value: 'daycase', label: 'Day Case (SS)' },
  { value: 'emergency', label: 'Emergency (EMER)' },
  { value: 'home', label: 'Home Healthcare (HH)' },
  { value: 'telemedicine', label: 'Telemedicine (VR)' }
];

// ============================================================================
// ENCOUNTER CLASS RULES BY AUTH TYPE
// Reference: NPHIES validation errors BV-00807, BV-00743
// Reference: NPHIES IG - Vision claims do NOT require Encounter
// ============================================================================
// - Outpatient: SHALL be used only when claim is 'oral' or 'professional'
// - Inpatient/Day Case/Inpatient Acute: SHALL be used only when claim is 'institutional'
// - Vision: NO ENCOUNTER - Vision claims are simple outpatient services without clinical encounter context

export const ALLOWED_ENCOUNTER_CLASSES = {
  // Institutional: MUST use inpatient (IMP), daycase (SS), or inpatient acute (ACUTE)
  // Per NPHIES BV-00741: Encounter Class Shall be either 'Inpatient Admission', 'Day Case Admission' or 'inpatient acute' for Institutional Claim
  // Per NPHIES BV-00845: Encounter Class 'Outpatient' SHALL be used only when claim is 'oral' or 'professional'
  institutional: ['inpatient', 'daycase'],
  
  // Professional: Can use outpatient, ambulatory, and other non-inpatient classes
  professional: ['outpatient', 'ambulatory', 'emergency', 'home', 'telemedicine'],
  
  // Dental (Oral): Must use ambulatory per NPHIES
  dental: ['ambulatory'],
  
  // Vision: NO ENCOUNTER REQUIRED per NPHIES IG
  // Vision Claims only contain: Patient, Provider, Diagnosis, Items, Benefit, Supporting Info
  vision: [],
  
  // Pharmacy: NO ENCOUNTER REQUIRED per NPHIES example Claim-483074.json
  // Pharmacy claims only contain: Patient, Provider, Diagnosis, Items, Insurance, Total
  pharmacy: []
};

// Helper function to get filtered encounter class options based on auth type
export const getEncounterClassOptions = (authType) => {
  // Vision and Pharmacy don't use Encounter at all per NPHIES examples
  if (authType === 'vision' || authType === 'pharmacy') {
    return [];
  }
  const allowed = ALLOWED_ENCOUNTER_CLASSES[authType] || ALLOWED_ENCOUNTER_CLASSES.professional;
  return ENCOUNTER_CLASS_OPTIONS.map(option => ({
    ...option,
    isDisabled: !allowed.includes(option.value)
  }));
};

// ============================================================================
// ADMIT SOURCE OPTIONS
// Reference: http://nphies.sa/terminology/CodeSystem/admit-source
// Used for: hospitalization.admitSource in Encounter resource
// ============================================================================
export const ADMIT_SOURCE_OPTIONS = [
  { value: 'WKIN', label: 'Walk-in' },
  { value: 'IA', label: 'Immediate Admission' },
  { value: 'EER', label: 'Admission from hospital ER' },
  { value: 'EOP', label: 'Emergency Admission from hospital outpatient' },
  { value: 'EPH', label: 'Emergency Admission by referral from private hospital' },
  { value: 'EGGH', label: 'Emergency Admission by referral from general government hospital' },
  { value: 'EPPHC', label: 'Emergency Admission by referral from private primary healthcare center' },
  { value: 'EGPHC', label: 'Emergency Admission by referral from government primary healthcare center' },
  { value: 'EIC', label: 'Emergency Admission by insurance company' },
  { value: 'EWIS', label: 'Elective waiting list admission insurance coverage Scheme' },
  { value: 'EWSS', label: 'Elective waiting list admission self-payment Scheme' },
  { value: 'EWGS', label: 'Elective waiting list admission government free Scheme' },
  { value: 'PMBA', label: 'Planned Maternity Birth Admission' },
  { value: 'EMBA', label: 'Emergency Maternity Birth Admission' },
  { value: 'PVAMB', label: 'Private ambulance' },
  { value: 'RECR', label: 'Red crescent' },
  { value: 'FMLYM', label: 'Family member' },
  { value: 'AA', label: 'Already admitted' },
  { value: 'AAIC', label: 'Already admitted - insurance consumed' },
  { value: 'Others', label: 'Others' }
];

export const CURRENCY_OPTIONS = [
  { value: 'SAR', label: 'SAR - Saudi Riyal' },
  { value: 'USD', label: 'USD - US Dollar' }
];

export const DIAGNOSIS_TYPE_OPTIONS = [
  { value: 'principal', label: 'Principal' },
  { value: 'secondary', label: 'Secondary' },
  { value: 'admitting', label: 'Admitting' },
  { value: 'discharge', label: 'Discharge' }
];

// Dental ICD-10 Codes (K00-K10)
export const DENTAL_ICD10_OPTIONS = [
  // K00 – Disorders of tooth development and eruption
  { value: 'K00.0', label: 'K00.0 - Anodontia' },
  { value: 'K00.1', label: 'K00.1 - Supernumerary teeth' },
  { value: 'K00.2', label: 'K00.2 - Abnormalities of size & form of teeth' },
  { value: 'K00.3', label: 'K00.3 - Mottled teeth' },
  { value: 'K00.4', label: 'K00.4 - Disturbances in tooth formation' },
  { value: 'K00.5', label: 'K00.5 - Hereditary disturbances of tooth structure' },
  { value: 'K00.6', label: 'K00.6 - Disturbances in tooth eruption' },
  { value: 'K00.7', label: 'K00.7 - Teething syndrome' },
  { value: 'K00.8', label: 'K00.8 - Other disorders of tooth development' },
  { value: 'K00.9', label: 'K00.9 - Disorder of tooth development, unspecified' },
  // K01 – Embedded and impacted teeth
  { value: 'K01.0', label: 'K01.0 - Embedded teeth' },
  { value: 'K01.1', label: 'K01.1 - Impacted teeth' },
  // K02 – Dental caries (decay)
  { value: 'K02.0', label: 'K02.0 - Caries of enamel' },
  { value: 'K02.1', label: 'K02.1 - Caries of dentin' },
  { value: 'K02.2', label: 'K02.2 - Caries of cementum' },
  { value: 'K02.3', label: 'K02.3 - Arrested dental caries' },
  { value: 'K02.4', label: 'K02.4 - Odontoclasia' },
  { value: 'K02.5', label: 'K02.5 - Dental caries on smooth surface' },
  { value: 'K02.6', label: 'K02.6 - Dental caries on pit and fissure' },
  { value: 'K02.7', label: 'K02.7 - Root caries' },
  { value: 'K02.8', label: 'K02.8 - Other dental caries' },
  { value: 'K02.9', label: 'K02.9 - Dental caries, unspecified' },
  // K03 – Other diseases of hard tissues of teeth
  { value: 'K03.0', label: 'K03.0 - Excessive attrition of teeth' },
  { value: 'K03.1', label: 'K03.1 - Abrasion of teeth' },
  { value: 'K03.2', label: 'K03.2 - Erosion of teeth' },
  { value: 'K03.3', label: 'K03.3 - Pathological resorption of teeth' },
  { value: 'K03.4', label: 'K03.4 - Hypercementosis' },
  { value: 'K03.5', label: 'K03.5 - Ankylosis of teeth' },
  { value: 'K03.6', label: 'K03.6 - Deposits (calculus) on teeth' },
  { value: 'K03.7', label: 'K03.7 - Posteruptive colour changes of dental hard tissues' },
  { value: 'K03.8', label: 'K03.8 - Other specified diseases of hard tissues' },
  { value: 'K03.9', label: 'K03.9 - Hard tissue disease, unspecified' },
  // K04 – Diseases of pulp and periapical tissues
  { value: 'K04.0', label: 'K04.0 - Pulpitis' },
  { value: 'K04.1', label: 'K04.1 - Necrosis of pulp' },
  { value: 'K04.2', label: 'K04.2 - Pulp degeneration' },
  { value: 'K04.3', label: 'K04.3 - Abnormal hard tissue formation in pulp' },
  { value: 'K04.4', label: 'K04.4 - Acute apical periodontitis of pulpal origin' },
  { value: 'K04.5', label: 'K04.5 - Chronic apical periodontitis' },
  { value: 'K04.6', label: 'K04.6 - Periapical abscess with sinus' },
  { value: 'K04.7', label: 'K04.7 - Periapical abscess without sinus' },
  { value: 'K04.8', label: 'K04.8 - Radicular cyst' },
  { value: 'K04.9', label: 'K04.9 - Other diseases of pulp/periapical tissue' },
  // K05 – Gingivitis and periodontal diseases
  { value: 'K05.0', label: 'K05.0 - Acute gingivitis' },
  { value: 'K05.1', label: 'K05.1 - Chronic gingivitis' },
  { value: 'K05.2', label: 'K05.2 - Acute periodontitis' },
  { value: 'K05.3', label: 'K05.3 - Chronic periodontitis' },
  { value: 'K05.4', label: 'K05.4 - Periodontosis' },
  { value: 'K05.5', label: 'K05.5 - Other periodontal diseases' },
  { value: 'K05.6', label: 'K05.6 - Periodontal disease, unspecified' },
  // K06 – Other disorders of gingiva and edentulous alveolar ridge
  { value: 'K06.0', label: 'K06.0 - Gingival recession' },
  { value: 'K06.1', label: 'K06.1 - Gingival enlargement' },
  { value: 'K06.2', label: 'K06.2 - Gingival/edentulous alveolar ridge disorder' },
  { value: 'K06.8', label: 'K06.8 - Other disorders of gingiva' },
  { value: 'K06.9', label: 'K06.9 - Disorder of gingiva, unspecified' },
  // K07 – Dentofacial anomalies
  { value: 'K07.0', label: 'K07.0 - Major anomalies of jaw size' },
  { value: 'K07.1', label: 'K07.1 - Anomalies of jaw-cranial base relationship' },
  { value: 'K07.2', label: 'K07.2 - Anomalies of dental arch relationship' },
  { value: 'K07.3', label: 'K07.3 - Anomalies of tooth position' },
  { value: 'K07.4', label: 'K07.4 - Malocclusion, unspecified' },
  { value: 'K07.5', label: 'K07.5 - Dentofacial functional anomalies' },
  { value: 'K07.6', label: 'K07.6 - Temporomandibular joint disorders' },
  { value: 'K07.8', label: 'K07.8 - Other dentofacial anomalies' },
  { value: 'K07.9', label: 'K07.9 - Dentofacial anomaly, unspecified' },
  // K08 – Loss of teeth and other local conditions
  { value: 'K08.0', label: 'K08.0 - Exfoliation of teeth due to systemic causes' },
  { value: 'K08.1', label: 'K08.1 - Loss of teeth due to accident/extraction' },
  { value: 'K08.2', label: 'K08.2 - Atrophy of edentulous alveolar ridge' },
  { value: 'K08.3', label: 'K08.3 - Retained dental root' },
  { value: 'K08.4', label: 'K08.4 - Odontogenic cysts' },
  { value: 'K08.8', label: 'K08.8 - Other conditions of teeth' },
  { value: 'K08.9', label: 'K08.9 - Condition of teeth, unspecified' },
  // K09 – Cysts of oral region
  { value: 'K09.0', label: 'K09.0 - Developmental odontogenic cysts' },
  { value: 'K09.1', label: 'K09.1 - Non-odontogenic developmental cysts' },
  { value: 'K09.2', label: 'K09.2 - Other cysts of jaws' },
  { value: 'K09.8', label: 'K09.8 - Other cysts of oral region' },
  { value: 'K09.9', label: 'K09.9 - Cyst of oral region, unspecified' },
  // K10 – Other diseases of jaws
  { value: 'K10.0', label: 'K10.0 - Developmental disorders of jaws' },
  { value: 'K10.1', label: 'K10.1 - Giant cell granuloma' },
  { value: 'K10.2', label: 'K10.2 - Inflammatory conditions of jaws' },
  { value: 'K10.3', label: 'K10.3 - Osteonecrosis of jaw' },
  { value: 'K10.8', label: 'K10.8 - Other diseases of jaws' },
  { value: 'K10.9', label: 'K10.9 - Disease of jaw, unspecified' }
];

// Dental Procedure Codes for Prior Authorization
// Reference: NPHIES Dental/Oral Procedure Codes (http://nphies.sa/terminology/CodeSystem/oral-health-op)
export const DENTAL_PROCEDURE_OPTIONS = [
  { value: '97011-00-00', label: '97011-00-00 - Comprehensive oral examination' },
  { value: '97043-00-00', label: '97043-00-00 - Dental antibiotic sensitivity test' },
  { value: '97613-07-00', label: '97613-07-00 - Lithium disilicate ceramic crown (e max), indirect; per crown' },
  { value: '012', label: '012 - Periodic oral examination' },
  { value: '97511-01-00', label: '97511-01-00 - Metallic restoration of tooth, one surface, direct' },
  { value: '618', label: '618 - Full crown metallic indirect' },
  { value: '658', label: '658 - The extraoral repair of a crown, bridge or splint' },
  { value: '97521-01-00', label: '97521-01-00 - Adhesive restoration tooth 1 surface direct' },
  { value: '415', label: '415 - Root canal' }
];

// NPHIES Procedure Codes for Institutional/Professional Prior Authorization
// Reference: http://nphies.sa/terminology/CodeSystem/procedures
export const NPHIES_PROCEDURE_OPTIONS = [
  { value: '30571-00-00', label: '30571-00-00 - Appendicectomy' },
  { value: '96196-01-00', label: '96196-01-00 - Intra-arterial administration of pharmacological agent, thrombolytic agent' },
  { value: '96092-00-10', label: '96092-00-10 - Fitting of spectacles' },
  { value: '13882-00-00', label: '13882-00-00 - Management of continuous ventilatory support, <= 24 hours' },
  { value: '38287-02-00', label: '38287-02-00 - Catheter ablation of arrhythmia circuit or focus involving left atrial chamber' },
  { value: '42503-00-02', label: '42503-00-02 - Ophthalmological examination, bilateral' },
  { value: '33509-00-00', label: '33509-00-00 - Aorta endarterectomy' }
];

// ============================================================================
// LOINC CODES FOR LAB OBSERVATIONS (Test Case #2 - Professional Authorization)
// Reference: https://loinc.org
// IMPORTANT: These codes are for Observation resources, NOT Claim.item.productOrService
// Use via supportingInfo with category = "laboratory" and valueReference to Observation
// ============================================================================
export const LOINC_LAB_OPTIONS = [
  // Testing LOINC codes specified in NPHIES Test Case #2
  { value: '80096-1', label: '80096-1 - Microalbumin/Creatinine [Ratio] in Urine', system: 'http://loinc.org', unit: 'mg/g', unitSystem: 'http://unitsofmeasure.org' },
  { value: '43863-0', label: '43863-0 - Urine specimen collection method', system: 'http://loinc.org', unit: '', unitSystem: '' },
  { value: '55951-8', label: '55951-8 - Urine sediment comments by Light microscopy', system: 'http://loinc.org', unit: '', unitSystem: '' },
  { value: '12419-8', label: '12419-8 - Sodium [Moles/volume] in Urine', system: 'http://loinc.org', unit: 'mmol/L', unitSystem: 'http://unitsofmeasure.org' },
  
  // Common Lab Tests
  { value: '2093-3', label: '2093-3 - Cholesterol [Mass/volume] in Serum or Plasma', system: 'http://loinc.org', unit: 'mg/dL', unitSystem: 'http://unitsofmeasure.org' },
  { value: '2085-9', label: '2085-9 - HDL Cholesterol [Mass/volume] in Serum or Plasma', system: 'http://loinc.org', unit: 'mg/dL', unitSystem: 'http://unitsofmeasure.org' },
  { value: '2089-1', label: '2089-1 - LDL Cholesterol [Mass/volume] in Serum or Plasma', system: 'http://loinc.org', unit: 'mg/dL', unitSystem: 'http://unitsofmeasure.org' },
  { value: '2571-8', label: '2571-8 - Triglycerides [Mass/volume] in Serum or Plasma', system: 'http://loinc.org', unit: 'mg/dL', unitSystem: 'http://unitsofmeasure.org' },
  { value: '2339-0', label: '2339-0 - Glucose [Mass/volume] in Blood', system: 'http://loinc.org', unit: 'mg/dL', unitSystem: 'http://unitsofmeasure.org' },
  { value: '4548-4', label: '4548-4 - Hemoglobin A1c/Hemoglobin.total in Blood', system: 'http://loinc.org', unit: '%', unitSystem: 'http://unitsofmeasure.org' },
  { value: '2160-0', label: '2160-0 - Creatinine [Mass/volume] in Serum or Plasma', system: 'http://loinc.org', unit: 'mg/dL', unitSystem: 'http://unitsofmeasure.org' },
  { value: '3094-0', label: '3094-0 - Urea nitrogen [Mass/volume] in Serum or Plasma', system: 'http://loinc.org', unit: 'mg/dL', unitSystem: 'http://unitsofmeasure.org' },
  { value: '1742-6', label: '1742-6 - Alanine aminotransferase [Enzymatic activity/volume] in Serum or Plasma', system: 'http://loinc.org', unit: 'U/L', unitSystem: 'http://unitsofmeasure.org' },
  { value: '1920-8', label: '1920-8 - Aspartate aminotransferase [Enzymatic activity/volume] in Serum or Plasma', system: 'http://loinc.org', unit: 'U/L', unitSystem: 'http://unitsofmeasure.org' },
  { value: '6690-2', label: '6690-2 - Leukocytes [#/volume] in Blood by Automated count', system: 'http://loinc.org', unit: '10*3/uL', unitSystem: 'http://unitsofmeasure.org' },
  { value: '789-8', label: '789-8 - Erythrocytes [#/volume] in Blood by Automated count', system: 'http://loinc.org', unit: '10*6/uL', unitSystem: 'http://unitsofmeasure.org' },
  { value: '718-7', label: '718-7 - Hemoglobin [Mass/volume] in Blood', system: 'http://loinc.org', unit: 'g/dL', unitSystem: 'http://unitsofmeasure.org' },
  { value: '777-3', label: '777-3 - Platelets [#/volume] in Blood by Automated count', system: 'http://loinc.org', unit: '10*3/uL', unitSystem: 'http://unitsofmeasure.org' },
  { value: '2951-2', label: '2951-2 - Sodium [Moles/volume] in Serum or Plasma', system: 'http://loinc.org', unit: 'mmol/L', unitSystem: 'http://unitsofmeasure.org' },
  { value: '2823-3', label: '2823-3 - Potassium [Moles/volume] in Serum or Plasma', system: 'http://loinc.org', unit: 'mmol/L', unitSystem: 'http://unitsofmeasure.org' },
  { value: '17861-6', label: '17861-6 - Calcium [Mass/volume] in Serum or Plasma', system: 'http://loinc.org', unit: 'mg/dL', unitSystem: 'http://unitsofmeasure.org' },
  { value: '3016-3', label: '3016-3 - Thyrotropin [Units/volume] in Serum or Plasma', system: 'http://loinc.org', unit: 'mU/L', unitSystem: 'http://unitsofmeasure.org' },
  { value: '3026-2', label: '3026-2 - Thyroxine (T4) [Mass/volume] in Serum or Plasma', system: 'http://loinc.org', unit: 'ug/dL', unitSystem: 'http://unitsofmeasure.org' },
  { value: '5767-9', label: '5767-9 - Appearance of Urine', system: 'http://loinc.org', unit: '', unitSystem: '' },
  { value: '5778-6', label: '5778-6 - Color of Urine', system: 'http://loinc.org', unit: '', unitSystem: '' },
  { value: '5803-2', label: '5803-2 - pH of Urine by Test strip', system: 'http://loinc.org', unit: '[pH]', unitSystem: 'http://unitsofmeasure.org' },
  { value: '5811-5', label: '5811-5 - Specific gravity of Urine by Test strip', system: 'http://loinc.org', unit: '', unitSystem: '' }
];

// Service Code System Options (for dropdown to select code system)
// NOTE: For Claim.item.productOrService, ONLY NPHIES codes are valid
// LOINC codes are for Observation resources, NOT for Claim items
export const SERVICE_CODE_SYSTEM_OPTIONS = [
  { value: 'nphies', label: 'NPHIES Procedures', system: 'http://nphies.sa/terminology/CodeSystem/procedures' },
  { value: 'nphies-lab', label: 'NPHIES Lab Services', system: 'http://nphies.sa/terminology/CodeSystem/procedures' }
];

// ============================================================================
// NPHIES LAB SERVICE CODES (for Claim.item.productOrService)
// Reference: http://nphies.sa/terminology/CodeSystem/procedures
// IMPORTANT: These are SERVICE codes, NOT LOINC codes
// LOINC codes go in Observation resources, referenced via supportingInfo
// ============================================================================
export const NPHIES_LAB_SERVICE_OPTIONS = [
  // General Lab Services - Use these for Claim.item.productOrService
  { value: '91.0', label: '91.0 - Laboratory investigation, unspecified', system: 'http://nphies.sa/terminology/CodeSystem/procedures' },
  { value: '91.01', label: '91.01 - Blood chemistry panel', system: 'http://nphies.sa/terminology/CodeSystem/procedures' },
  { value: '91.02', label: '91.02 - Complete blood count (CBC)', system: 'http://nphies.sa/terminology/CodeSystem/procedures' },
  { value: '91.03', label: '91.03 - Urinalysis', system: 'http://nphies.sa/terminology/CodeSystem/procedures' },
  { value: '91.04', label: '91.04 - Lipid panel', system: 'http://nphies.sa/terminology/CodeSystem/procedures' },
  { value: '91.05', label: '91.05 - Liver function tests', system: 'http://nphies.sa/terminology/CodeSystem/procedures' },
  { value: '91.06', label: '91.06 - Kidney function tests', system: 'http://nphies.sa/terminology/CodeSystem/procedures' },
  { value: '91.07', label: '91.07 - Thyroid function tests', system: 'http://nphies.sa/terminology/CodeSystem/procedures' },
  { value: '91.08', label: '91.08 - Glucose tolerance test', system: 'http://nphies.sa/terminology/CodeSystem/procedures' },
  { value: '91.09', label: '91.09 - HbA1c test', system: 'http://nphies.sa/terminology/CodeSystem/procedures' },
  { value: '91.10', label: '91.10 - Coagulation panel', system: 'http://nphies.sa/terminology/CodeSystem/procedures' },
  { value: '91.11', label: '91.11 - Electrolyte panel', system: 'http://nphies.sa/terminology/CodeSystem/procedures' },
  { value: '91.12', label: '91.12 - Urine microalbumin test', system: 'http://nphies.sa/terminology/CodeSystem/procedures' },
  // Specific lab tests
  { value: '90.59', label: '90.59 - Other microscopic examination', system: 'http://nphies.sa/terminology/CodeSystem/procedures' },
  { value: '90.69', label: '90.69 - Other culture and sensitivity', system: 'http://nphies.sa/terminology/CodeSystem/procedures' },
  { value: '90.79', label: '90.79 - Other serology', system: 'http://nphies.sa/terminology/CodeSystem/procedures' },
  { value: '90.89', label: '90.89 - Other immunology', system: 'http://nphies.sa/terminology/CodeSystem/procedures' },
  { value: '90.99', label: '90.99 - Other laboratory examination', system: 'http://nphies.sa/terminology/CodeSystem/procedures' }
];

// Vision ICD-10 Codes for eye examinations and disorders
// Reference: https://icd.who.int/browse10/2016/en
export const VISION_ICD10_OPTIONS = [
  // === Z01 - Eye Examination Encounters ===
  { value: 'Z01.0', label: 'Z01.0 - Examination of eyes and vision' },
  { value: 'Z01.00', label: 'Z01.00 - Encounter for examination of eyes and vision without abnormal findings' },
  { value: 'Z01.01', label: 'Z01.01 - Encounter for examination of eyes and vision with abnormal findings' },
  { value: 'Z01.02', label: 'Z01.02 - Encounter for examination of eyes and vision following failed vision screening' },
  
  // === H52 - Disorders of Refraction and Accommodation ===
  { value: 'H52.0', label: 'H52.0 - Hypermetropia (Farsightedness)' },
  { value: 'H52.1', label: 'H52.1 - Myopia (Nearsightedness)' },
  { value: 'H52.2', label: 'H52.2 - Astigmatism' },
  { value: 'H52.20', label: 'H52.20 - Unspecified astigmatism' },
  { value: 'H52.21', label: 'H52.21 - Irregular astigmatism' },
  { value: 'H52.22', label: 'H52.22 - Regular astigmatism' },
  { value: 'H52.3', label: 'H52.3 - Anisometropia and aniseikonia' },
  { value: 'H52.31', label: 'H52.31 - Anisometropia' },
  { value: 'H52.32', label: 'H52.32 - Aniseikonia' },
  { value: 'H52.4', label: 'H52.4 - Presbyopia' },
  { value: 'H52.5', label: 'H52.5 - Disorders of accommodation' },
  { value: 'H52.6', label: 'H52.6 - Other disorders of refraction' },
  { value: 'H52.7', label: 'H52.7 - Unspecified disorder of refraction' },
  
  // === H53 - Visual Disturbances ===
  { value: 'H53.0', label: 'H53.0 - Amblyopia ex anopsia (Lazy eye)' },
  { value: 'H53.00', label: 'H53.00 - Unspecified amblyopia' },
  { value: 'H53.01', label: 'H53.01 - Deprivation amblyopia' },
  { value: 'H53.02', label: 'H53.02 - Refractive amblyopia' },
  { value: 'H53.03', label: 'H53.03 - Strabismic amblyopia' },
  { value: 'H53.1', label: 'H53.1 - Subjective visual disturbances' },
  { value: 'H53.2', label: 'H53.2 - Diplopia (Double vision)' },
  { value: 'H53.3', label: 'H53.3 - Other disorders of binocular vision' },
  { value: 'H53.4', label: 'H53.4 - Visual field defects' },
  { value: 'H53.5', label: 'H53.5 - Color vision deficiencies' },
  { value: 'H53.6', label: 'H53.6 - Night blindness' },
  { value: 'H53.8', label: 'H53.8 - Other visual disturbances' },
  { value: 'H53.9', label: 'H53.9 - Unspecified visual disturbance' },
  
  // === H54 - Visual Impairment Including Blindness ===
  { value: 'H54.0', label: 'H54.0 - Blindness, both eyes' },
  { value: 'H54.1', label: 'H54.1 - Blindness, one eye, low vision other eye' },
  { value: 'H54.2', label: 'H54.2 - Low vision, both eyes' },
  { value: 'H54.3', label: 'H54.3 - Unqualified visual loss, both eyes' },
  { value: 'H54.4', label: 'H54.4 - Blindness, one eye' },
  { value: 'H54.5', label: 'H54.5 - Low vision, one eye' },
  { value: 'H54.6', label: 'H54.6 - Unqualified visual loss, one eye' },
  { value: 'H54.7', label: 'H54.7 - Unspecified visual loss' },
  
  // === Other Common Eye Conditions ===
  { value: 'H40.9', label: 'H40.9 - Unspecified glaucoma' },
  { value: 'H25.9', label: 'H25.9 - Unspecified age-related cataract' },
  { value: 'H26.9', label: 'H26.9 - Unspecified cataract' },
  { value: 'H35.30', label: 'H35.30 - Unspecified macular degeneration' },
  { value: 'H04.12', label: 'H04.12 - Dry eye syndrome' },
  { value: 'H10.9', label: 'H10.9 - Unspecified conjunctivitis' },
  { value: 'H16.9', label: 'H16.9 - Unspecified keratitis' },
  { value: 'H50.9', label: 'H50.9 - Unspecified strabismus' }
];

export const EYE_OPTIONS = [
  { value: 'left', label: 'Left' },
  { value: 'right', label: 'Right' },
  { value: 'both', label: 'Both' }
];

// ============================================================================
// BODY SITE OPTIONS BY AUTHORIZATION TYPE
// Reference: CMS/HCPCS Body Site Modifiers
// ============================================================================

// Vision Body Sites
export const VISION_BODY_SITE_OPTIONS = [
  { value: 'RIV', label: 'RIV - Right eye', display: 'Right eye' },
  { value: 'LIV', label: 'LIV - Left eye', display: 'Left eye' },
  { value: 'E1', label: 'E1 - Upper left, eyelid', display: 'Upper left, eyelid' },
  { value: 'E2', label: 'E2 - Lower left, eyelid', display: 'Lower left, eyelid' },
  { value: 'E3', label: 'E3 - Upper right, eyelid', display: 'Upper right, eyelid' },
  { value: 'E4', label: 'E4 - Lower right, eyelid', display: 'Lower right, eyelid' }
];

// Hand/Digit Body Sites (Professional/Institutional)
export const HAND_BODY_SITE_OPTIONS = [
  // Left Hand
  { value: 'FA', label: 'FA - Left hand, thumb', display: 'Left hand, thumb' },
  { value: 'F1', label: 'F1 - Left hand, second digit', display: 'Left hand, second digit' },
  { value: 'F2', label: 'F2 - Left hand, third digit', display: 'Left hand, third digit' },
  { value: 'F3', label: 'F3 - Left hand, fourth digit', display: 'Left hand, fourth digit' },
  { value: 'F4', label: 'F4 - Left hand, fifth digit', display: 'Left hand, fifth digit' },
  // Right Hand
  { value: 'F5', label: 'F5 - Right hand, thumb', display: 'Right hand, thumb' },
  { value: 'F6', label: 'F6 - Right hand, second digit', display: 'Right hand, second digit' },
  { value: 'F7', label: 'F7 - Right hand, third digit', display: 'Right hand, third digit' },
  { value: 'F8', label: 'F8 - Right hand, fourth digit', display: 'Right hand, fourth digit' },
  { value: 'F9', label: 'F9 - Right hand, fifth digit', display: 'Right hand, fifth digit' }
];

// Foot/Toe Body Sites (Professional/Institutional)
export const FOOT_BODY_SITE_OPTIONS = [
  // Left Foot
  { value: 'TA', label: 'TA - Left foot, great toe', display: 'Left foot, great toe' },
  { value: 'T1', label: 'T1 - Left foot, second digit', display: 'Left foot, second digit' },
  { value: 'T2', label: 'T2 - Left foot, third digit', display: 'Left foot, third digit' },
  { value: 'T3', label: 'T3 - Left foot, fourth digit', display: 'Left foot, fourth digit' },
  { value: 'T4', label: 'T4 - Left foot, fifth digit', display: 'Left foot, fifth digit' },
  // Right Foot
  { value: 'T5', label: 'T5 - Right foot, great toe', display: 'Right foot, great toe' },
  { value: 'T6', label: 'T6 - Right foot, second digit', display: 'Right foot, second digit' },
  { value: 'T7', label: 'T7 - Right foot, third digit', display: 'Right foot, third digit' },
  { value: 'T8', label: 'T8 - Right foot, fourth digit', display: 'Right foot, fourth digit' },
  { value: 'T9', label: 'T9 - Right foot, fifth digit', display: 'Right foot, fifth digit' }
];

// Coronary Artery Body Sites (Institutional/Professional - Cardiac)
export const CORONARY_BODY_SITE_OPTIONS = [
  { value: 'LC', label: 'LC - Left circumflex coronary artery', display: 'Left circumflex coronary artery' },
  { value: 'LD', label: 'LD - Left anterior descending coronary artery', display: 'Left anterior descending coronary artery' },
  { value: 'LM', label: 'LM - Left main coronary artery', display: 'Left main coronary artery' },
  { value: 'RC', label: 'RC - Right coronary artery', display: 'Right coronary artery' },
  { value: 'RI', label: 'RI - Ramus intermedius coronary artery', display: 'Ramus intermedius coronary artery' }
];

// General Side Indicators
export const SIDE_BODY_SITE_OPTIONS = [
  { value: 'LT', label: 'LT - Left side', display: 'Left side (used to identify procedures performed on the left side of the body)' },
  { value: 'RT', label: 'RT - Right side', display: 'Right side (used to identify procedures performed on the right side of the body)' }
];

// Combined Body Site Options by Authorization Type
// Reference: NPHIES IG - Vision claims do NOT use bodySite (BV-00374)
export const BODY_SITE_OPTIONS_BY_AUTH_TYPE = {
  // Vision: NO bodySite on items per NPHIES BV-00374
  // Vision claims use VisionPrescription resource for eye-specific details
  vision: [],
  dental: [], // Dental uses FDI tooth codes instead
  professional: [
    ...SIDE_BODY_SITE_OPTIONS,
    ...HAND_BODY_SITE_OPTIONS,
    ...FOOT_BODY_SITE_OPTIONS,
    ...CORONARY_BODY_SITE_OPTIONS
  ],
  institutional: [
    ...SIDE_BODY_SITE_OPTIONS,
    ...HAND_BODY_SITE_OPTIONS,
    ...FOOT_BODY_SITE_OPTIONS,
    ...CORONARY_BODY_SITE_OPTIONS
  ],
  pharmacy: [] // Pharmacy typically doesn't use body sites
};

// FDI Oral Region Codes (NPHIES fdi-oral-region CodeSystem)
// Permanent teeth: Quadrants 1-4 (11-48)
// Deciduous teeth: Quadrants 5-8 (51-85)
export const FDI_TOOTH_OPTIONS = [
  // === PERMANENT TEETH ===
  // Upper Right (Quadrant 1)
  { value: '11', label: '11 - UPPER RIGHT; PERMANENT TEETH # 1', display: 'UPPER RIGHT; PERMANENT TEETH # 1' },
  { value: '12', label: '12 - UPPER RIGHT; PERMANENT TEETH # 2', display: 'UPPER RIGHT; PERMANENT TEETH # 2' },
  { value: '13', label: '13 - UPPER RIGHT; PERMANENT TEETH # 3', display: 'UPPER RIGHT; PERMANENT TEETH # 3' },
  { value: '14', label: '14 - UPPER RIGHT; PERMANENT TEETH # 4', display: 'UPPER RIGHT; PERMANENT TEETH # 4' },
  { value: '15', label: '15 - UPPER RIGHT; PERMANENT TEETH # 5', display: 'UPPER RIGHT; PERMANENT TEETH # 5' },
  { value: '16', label: '16 - UPPER RIGHT; PERMANENT TEETH # 6', display: 'UPPER RIGHT; PERMANENT TEETH # 6' },
  { value: '17', label: '17 - UPPER RIGHT; PERMANENT TEETH # 7', display: 'UPPER RIGHT; PERMANENT TEETH # 7' },
  { value: '18', label: '18 - UPPER RIGHT; PERMANENT TEETH # 8', display: 'UPPER RIGHT; PERMANENT TEETH # 8' },
  // Upper Left (Quadrant 2)
  { value: '21', label: '21 - UPPER LEFT; PERMANENT TEETH # 1', display: 'UPPER LEFT; PERMANENT TEETH # 1' },
  { value: '22', label: '22 - UPPER LEFT; PERMANENT TEETH # 2', display: 'UPPER LEFT; PERMANENT TEETH # 2' },
  { value: '23', label: '23 - UPPER LEFT; PERMANENT TEETH # 3', display: 'UPPER LEFT; PERMANENT TEETH # 3' },
  { value: '24', label: '24 - UPPER LEFT; PERMANENT TEETH # 4', display: 'UPPER LEFT; PERMANENT TEETH # 4' },
  { value: '25', label: '25 - UPPER LEFT; PERMANENT TEETH # 5', display: 'UPPER LEFT; PERMANENT TEETH # 5' },
  { value: '26', label: '26 - UPPER LEFT; PERMANENT TEETH # 6', display: 'UPPER LEFT; PERMANENT TEETH # 6' },
  { value: '27', label: '27 - UPPER LEFT; PERMANENT TEETH # 7', display: 'UPPER LEFT; PERMANENT TEETH # 7' },
  { value: '28', label: '28 - UPPER LEFT; PERMANENT TEETH # 8', display: 'UPPER LEFT; PERMANENT TEETH # 8' },
  // Lower Left (Quadrant 3)
  { value: '31', label: '31 - LOWER LEFT; PERMANENT TEETH # 1', display: 'LOWER LEFT; PERMANENT TEETH # 1' },
  { value: '32', label: '32 - LOWER LEFT; PERMANENT TEETH # 2', display: 'LOWER LEFT; PERMANENT TEETH # 2' },
  { value: '33', label: '33 - LOWER LEFT; PERMANENT TEETH # 3', display: 'LOWER LEFT; PERMANENT TEETH # 3' },
  { value: '34', label: '34 - LOWER LEFT; PERMANENT TEETH # 4', display: 'LOWER LEFT; PERMANENT TEETH # 4' },
  { value: '35', label: '35 - LOWER LEFT; PERMANENT TEETH # 5', display: 'LOWER LEFT; PERMANENT TEETH # 5' },
  { value: '36', label: '36 - LOWER LEFT; PERMANENT TEETH # 6', display: 'LOWER LEFT; PERMANENT TEETH # 6' },
  { value: '37', label: '37 - LOWER LEFT; PERMANENT TEETH # 7', display: 'LOWER LEFT; PERMANENT TEETH # 7' },
  { value: '38', label: '38 - LOWER LEFT; PERMANENT TEETH # 8', display: 'LOWER LEFT; PERMANENT TEETH # 8' },
  // Lower Right (Quadrant 4)
  { value: '41', label: '41 - LOWER RIGHT; PERMANENT TEETH # 1', display: 'LOWER RIGHT; PERMANENT TEETH # 1' },
  { value: '42', label: '42 - LOWER RIGHT; PERMANENT TEETH # 2', display: 'LOWER RIGHT; PERMANENT TEETH # 2' },
  { value: '43', label: '43 - LOWER RIGHT; PERMANENT TEETH # 3', display: 'LOWER RIGHT; PERMANENT TEETH # 3' },
  { value: '44', label: '44 - LOWER RIGHT; PERMANENT TEETH # 4', display: 'LOWER RIGHT; PERMANENT TEETH # 4' },
  { value: '45', label: '45 - LOWER RIGHT; PERMANENT TEETH # 5', display: 'LOWER RIGHT; PERMANENT TEETH # 5' },
  { value: '46', label: '46 - LOWER RIGHT; PERMANENT TEETH # 6', display: 'LOWER RIGHT; PERMANENT TEETH # 6' },
  { value: '47', label: '47 - LOWER RIGHT; PERMANENT TEETH # 7', display: 'LOWER RIGHT; PERMANENT TEETH # 7' },
  { value: '48', label: '48 - LOWER RIGHT; PERMANENT TEETH # 8', display: 'LOWER RIGHT; PERMANENT TEETH # 8' },
  // === DECIDUOUS (BABY) TEETH ===
  // Upper Right Deciduous (Quadrant 5)
  { value: '51', label: '51 - UPPER RIGHT; DECIDUOUS TEETH # 1', display: 'UPPER RIGHT; DECIDUOUS TEETH # 1' },
  { value: '52', label: '52 - UPPER RIGHT; DECIDUOUS TEETH # 2', display: 'UPPER RIGHT; DECIDUOUS TEETH # 2' },
  { value: '53', label: '53 - UPPER RIGHT; DECIDUOUS TEETH # 3', display: 'UPPER RIGHT; DECIDUOUS TEETH # 3' },
  { value: '54', label: '54 - UPPER RIGHT; DECIDUOUS TEETH # 4', display: 'UPPER RIGHT; DECIDUOUS TEETH # 4' },
  { value: '55', label: '55 - UPPER RIGHT; DECIDUOUS TEETH # 5', display: 'UPPER RIGHT; DECIDUOUS TEETH # 5' },
  // Upper Left Deciduous (Quadrant 6)
  { value: '61', label: '61 - UPPER LEFT; DECIDUOUS TEETH # 1', display: 'UPPER LEFT; DECIDUOUS TEETH # 1' },
  { value: '62', label: '62 - UPPER LEFT; DECIDUOUS TEETH # 2', display: 'UPPER LEFT; DECIDUOUS TEETH # 2' },
  { value: '63', label: '63 - UPPER LEFT; DECIDUOUS TEETH # 3', display: 'UPPER LEFT; DECIDUOUS TEETH # 3' },
  { value: '64', label: '64 - UPPER LEFT; DECIDUOUS TEETH # 4', display: 'UPPER LEFT; DECIDUOUS TEETH # 4' },
  { value: '65', label: '65 - UPPER LEFT; DECIDUOUS TEETH # 5', display: 'UPPER LEFT; DECIDUOUS TEETH # 5' },
  // Lower Left Deciduous (Quadrant 7)
  { value: '71', label: '71 - LOWER LEFT; DECIDUOUS TEETH # 1', display: 'LOWER LEFT; DECIDUOUS TEETH # 1' },
  { value: '72', label: '72 - LOWER LEFT; DECIDUOUS TEETH # 2', display: 'LOWER LEFT; DECIDUOUS TEETH # 2' },
  { value: '73', label: '73 - LOWER LEFT; DECIDUOUS TEETH # 3', display: 'LOWER LEFT; DECIDUOUS TEETH # 3' },
  { value: '74', label: '74 - LOWER LEFT; DECIDUOUS TEETH # 4', display: 'LOWER LEFT; DECIDUOUS TEETH # 4' },
  { value: '75', label: '75 - LOWER LEFT; DECIDUOUS TEETH # 5', display: 'LOWER LEFT; DECIDUOUS TEETH # 5' },
  // Lower Right Deciduous (Quadrant 8)
  { value: '81', label: '81 - LOWER RIGHT; DECIDUOUS TEETH # 1', display: 'LOWER RIGHT; DECIDUOUS TEETH # 1' },
  { value: '82', label: '82 - LOWER RIGHT; DECIDUOUS TEETH # 2', display: 'LOWER RIGHT; DECIDUOUS TEETH # 2' },
  { value: '83', label: '83 - LOWER RIGHT; DECIDUOUS TEETH # 3', display: 'LOWER RIGHT; DECIDUOUS TEETH # 3' },
  { value: '84', label: '84 - LOWER RIGHT; DECIDUOUS TEETH # 4', display: 'LOWER RIGHT; DECIDUOUS TEETH # 4' },
  { value: '85', label: '85 - LOWER RIGHT; DECIDUOUS TEETH # 5', display: 'LOWER RIGHT; DECIDUOUS TEETH # 5' }
];

// Tooth Surface Codes for dental procedures (NPHIES tooth-surface CodeSystem)
export const TOOTH_SURFACE_OPTIONS = [
  // Single surfaces
  { value: 'M', label: 'M - Mesial (closest to midline)' },
  { value: 'O', label: 'O - Occlusal (chewing surface)' },
  { value: 'I', label: 'I - Incisal (biting edge)' },
  { value: 'D', label: 'D - Distal (away from midline)' },
  { value: 'B', label: 'B - Buccal (facing cheeks)' },
  { value: 'V', label: 'V - Ventral (facing lips)' },
  { value: 'L', label: 'L - Lingual (facing tongue)' },
  // Combined surfaces
  { value: 'MO', label: 'MO - Mesioclusal' },
  { value: 'DO', label: 'DO - Distoclusal' },
  { value: 'DI', label: 'DI - Distoincisal' },
  { value: 'MOD', label: 'MOD - Mesioclusodistal' }
];

// NPHIES Claim Information Category codes
// Reference: http://nphies.sa/terminology/CodeSystem/claim-information-category
// Source: https://portal.nphies.sa/ig/CodeSystem-claim-information-category.html
export const SUPPORTING_INFO_CATEGORY_OPTIONS = [
  // General categories
  { value: 'info', label: 'info - Information', description: 'Codes conveying additional situation and condition information', needsCode: false },
  { value: 'onset', label: 'onset - Onset', description: 'Period, start or end dates of aspects of the Condition', needsCode: false },
  { value: 'attachment', label: 'attachment - Attachment', description: 'Materials attached such as images, documents and resources', needsCode: false },
  { value: 'employmentImpacted', label: 'employmentImpacted - Employment Impacted', description: 'An indication that the patient was unable to work', needsCode: false },
  
  // Clinical categories
  { value: 'chief-complaint', label: 'chief-complaint - Chief Complaint', description: 'A concise statement describing the symptom, problem, condition, or reason for encounter', needsCode: false },
  { value: 'reason-for-visit', label: 'reason-for-visit - Reason for Visit', description: 'Reason for visit', needsCode: false },
  { value: 'investigation-result', label: 'investigation-result - Investigation Result', description: 'Investigation Result', needsCode: false },
  { value: 'treatment-plan', label: 'treatment-plan - Treatment Plan', description: 'Treatment Plan', needsCode: false },
  { value: 'patient-history', label: 'patient-history - Patient History', description: 'Past Surgical History', needsCode: false },
  { value: 'physical-examination', label: 'physical-examination - Physical Examination', description: 'Physical Examination', needsCode: false },
  { value: 'history-of-present-illness', label: 'history-of-present-illness - History Of Present Illness', description: 'History Of Present Illness', needsCode: false },
  { value: 'lab-test', label: 'lab-test - Lab Test', description: 'Test code', needsCode: true },
  
  // Vital signs
  { value: 'vital-sign-weight', label: 'vital-sign-weight - Weight', description: 'Weight', needsCode: false },
  { value: 'vital-sign-height', label: 'vital-sign-height - Height', description: 'Height', needsCode: false },
  { value: 'vital-sign-systolic', label: 'vital-sign-systolic - Systolic', description: 'Systolic blood pressure', needsCode: false },
  { value: 'vital-sign-diastolic', label: 'vital-sign-diastolic - Diastolic', description: 'Diastolic blood pressure', needsCode: false },
  { value: 'temperature', label: 'temperature - Temperature', description: 'The body temperature in degree celsius', needsCode: false },
  { value: 'pulse', label: 'pulse - Pulse', description: 'Pulse rate per minute', needsCode: false },
  { value: 'oxygen-saturation', label: 'oxygen-saturation - Oxygen Saturation', description: 'Blood oxygen saturation in %', needsCode: false },
  { value: 'respiratory-rate', label: 'respiratory-rate - Respiratory Rate', description: 'Respiratory rate per minute', needsCode: false },
  
  // Hospital/admission specific
  { value: 'icu-hours', label: 'icu-hours - ICU Hours', description: 'Number of hours spent in ICU', needsCode: false },
  { value: 'ventilation-hours', label: 'ventilation-hours - Ventilation Hours', description: 'Number of hours under mechanical ventilation', needsCode: false },
  { value: 'admission-weight', label: 'admission-weight - Admission Weight', description: 'Admission Weight', needsCode: false },
  { value: 'estimated-Length-of-Stay', label: 'estimated-Length-of-Stay - Estimated Length Of Stay', description: 'Estimated Length Of Stay', needsCode: false },
  
  // Dental specific
  { value: 'missingtooth', label: 'missingtooth - Missing Tooth', description: 'Teeth which are missing for any reason', needsCode: false },
  
  // Pharmacy specific
  { value: 'days-supply', label: 'days-supply - Days Supply', description: 'Days Supply (for medications)', needsCode: false },
  
  // Maternity/Birth
  { value: 'last-menstrual-period', label: 'last-menstrual-period - Last Menstrual Period', description: 'Start date of last menstrual period', needsCode: false },
  { value: 'birth-weight', label: 'birth-weight - Birth Weight', description: 'Birth weight is the first weight of the new born', needsCode: false },
  
  // Other
  { value: 'morphology', label: 'morphology - Morphology', description: 'Historical morphology of the reported tumor diagnosis', needsCode: false }
];

// NPHIES Vital Signs Fields (per Claim-483069.json example)
export const VITAL_SIGNS_FIELDS = [
  { key: 'systolic', category: 'vital-sign-systolic', label: 'Systolic BP', unit: 'mm[Hg]', unitLabel: 'mmHg', placeholder: '120' },
  { key: 'diastolic', category: 'vital-sign-diastolic', label: 'Diastolic BP', unit: 'mm[Hg]', unitLabel: 'mmHg', placeholder: '80' },
  { key: 'height', category: 'vital-sign-height', label: 'Height', unit: 'cm', unitLabel: 'cm', placeholder: '170' },
  { key: 'weight', category: 'vital-sign-weight', label: 'Weight', unit: 'kg', unitLabel: 'kg', placeholder: '70' },
  { key: 'pulse', category: 'pulse', label: 'Pulse Rate', unit: '/min', unitLabel: 'bpm', placeholder: '72' },
  { key: 'temperature', category: 'temperature', label: 'Temperature', unit: 'Cel', unitLabel: '°C', placeholder: '37' },
  { key: 'oxygen_saturation', category: 'oxygen-saturation', label: 'O2 Saturation', unit: '%', unitLabel: '%', placeholder: '98' },
  { key: 'respiratory_rate', category: 'respiratory-rate', label: 'Respiratory Rate', unit: '/min', unitLabel: '/min', placeholder: '16' }
];

// NPHIES Clinical Text Fields
export const CLINICAL_TEXT_FIELDS = [
  { key: 'patient_history', category: 'patient-history', label: 'Patient History', placeholder: 'Document any relevant patient history, allergies, chronic conditions...' },
  { key: 'history_of_present_illness', category: 'history-of-present-illness', label: 'History of Present Illness', placeholder: 'Describe the current illness, symptoms, and timeline...' },
  { key: 'physical_examination', category: 'physical-examination', label: 'Physical Examination', placeholder: 'Document physical examination findings...' },
  { key: 'treatment_plan', category: 'treatment-plan', label: 'Treatment Plan', placeholder: 'Describe the proposed treatment plan...' }
];

// NPHIES Admission-specific Fields (for inpatient/daycase)
export const ADMISSION_FIELDS = [
  { key: 'admission_weight', category: 'admission-weight', label: 'Admission Weight', unit: 'kg', unitLabel: 'kg', placeholder: '70' },
  { key: 'estimated_length_of_stay', category: 'estimated-Length-of-Stay', label: 'Estimated Length of Stay', unit: 'd', unitLabel: 'days', placeholder: '3' }
];

// NPHIES ICU-specific Fields (for institutional inpatient/daycase)
export const ICU_FIELDS = [
  { key: 'icu_hours', category: 'icu-hours', label: 'ICU Hours', unit: 'h', unitLabel: 'hours', placeholder: '24' }
];

// NPHIES Service Event Type Options (for dental/oral and professional claims)
// Reference: http://nphies.sa/terminology/CodeSystem/service-event-type
export const SERVICE_EVENT_TYPE_OPTIONS = [
  { value: 'ICSE', label: 'ICSE - Initial client service event (New Visit)' },
  { value: 'SCSE', label: 'SCSE - Subsequent client service event (Follow-up)' }
];

// NPHIES Triage Category Options (for emergency encounters)
// Reference: http://nphies.sa/terminology/CodeSystem/triage-category
// Reference: https://portal.nphies.sa/ig/Encounter-10122.json.html
export const TRIAGE_CATEGORY_OPTIONS = [
  { value: 'I', label: 'I - Immediate (Life threatening)' },
  { value: 'VU', label: 'VU - Very Urgent (Serious)' },
  { value: 'U', label: 'U - Urgent (Significant)' },
  { value: 'S', label: 'S - Standard (Routine)' },
  { value: 'NS', label: 'NS - Non-Standard (Minor)' }
];

// NPHIES Service Type Options (for encounter)
// Reference: http://nphies.sa/terminology/CodeSystem/service-type
export const ENCOUNTER_SERVICE_TYPE_OPTIONS = [
  { value: 'acute-care', label: 'Acute Care' },
  { value: 'sub-acute-care', label: 'Sub-Acute Care' },
  { value: 'rehabilitation', label: 'Rehabilitation' },
  { value: 'mental-behavioral', label: 'Mental & Behavioral' },
  { value: 'geriatric-care', label: 'Geriatric Care' },
  { value: 'newborn', label: 'Newborn' },
  { value: 'family-planning', label: 'Family Planning' },
  { value: 'dental-care', label: 'Dental Care' },
  { value: 'palliative-care', label: 'Palliative Care' },
  { value: 'others', label: 'Others' },
  { value: 'unknown', label: 'Unknown' }
];

// NPHIES Encounter Priority Options (for emergency encounters)
// Reference: http://terminology.hl7.org/CodeSystem/v3-ActPriority
export const ENCOUNTER_PRIORITY_OPTIONS = [
  { value: 'EM', label: 'Emergency' },
  { value: 'UR', label: 'Urgent' },
  { value: 'S', label: 'Stat' },
  { value: 'A', label: 'ASAP' },
  { value: 'R', label: 'Routine' },
  { value: 'EL', label: 'Elective' }
];

// NPHIES Investigation Result Options (for dental/oral claims)
// Reference: http://nphies.sa/terminology/CodeSystem/investigation-result
// Note: Per official NPHIES oral example (Claim-293093), investigation-result is NOT required for oral claims
export const INVESTIGATION_RESULT_OPTIONS = [
  { value: 'IRA', label: 'IRA - Investigation results attached' },
  { value: 'INP', label: 'INP - Investigation(s) not performed' },
  { value: 'IRP', label: 'IRP - Investigation results pending' },
  { value: 'NA', label: 'NA - Not applicable' },
  { value: 'other', label: 'Other' }
];

// NPHIES Dental Chief Complaint Options (SNOMED-CT codes)
// Reference: https://portal.nphies.sa/ig/Claim-293093.json.html
// Oral claims ONLY require chief-complaint with SNOMED code (no investigation-result needed)
export const DENTAL_CHIEF_COMPLAINT_OPTIONS = [
  { value: '27355003', label: '27355003 - Toothache' },
  { value: '80353004', label: '80353004 - Enamel caries' },
  { value: '109564008', label: '109564008 - Dental caries' },
  { value: '234948008', label: '234948008 - Dental abscess' },
  { value: '82212003', label: '82212003 - Pulpitis' },
  { value: '6288001', label: '6288001 - Periodontitis' },
  { value: '66383009', label: '66383009 - Gingivitis' },
  { value: '41652007', label: '41652007 - Malocclusion' },
  { value: '399095008', label: '399095008 - Fractured tooth' },
  { value: '234947003', label: '234947003 - Missing tooth' },
  { value: '37320007', label: '37320007 - Impacted tooth' },
  { value: '46726004', label: '46726004 - Temporomandibular joint disorder' },
  { value: '702402003', label: '702402003 - Dental examination' },
  { value: '35198009', label: '35198009 - Dental prophylaxis' },
  { value: 'other', label: 'Other (specify code)' }
];

// Chief Complaint Format Options (for dental/oral claims)
// NPHIES supports both SNOMED codes (Claim-293093) and free text (Claim-298042)
export const CHIEF_COMPLAINT_FORMAT_OPTIONS = [
  { value: 'snomed', label: 'SNOMED Code (structured)' },
  { value: 'text', label: 'Free Text' }
];

// NPHIES Practice Codes (for careTeam.qualification) - Grouped by category
// Reference: http://nphies.sa/terminology/CodeSystem/practice-codes
// Updated: December 2024 - Official NPHIES CodeSystem
export const PRACTICE_CODES_OPTIONS = [
  {
    label: '01 - Anesthesiology',
    options: [
      { value: '01.00', label: '01.00 - Anesthesiology Specialty' },
      { value: '01.01', label: '01.01 - Ambulatory Anesthesia' },
      { value: '01.02', label: '01.02 - Anesthesia Cardiology' },
      { value: '01.03', label: '01.03 - Neuro-Anesthesia' },
      { value: '01.04', label: '01.04 - Obstetrics Anesthesia' },
      { value: '01.05', label: '01.05 - Pediatrics Anesthesia' },
      { value: '01.06', label: '01.06 - Pediatrics Cardiac Anesthesia' },
      { value: '01.07', label: '01.07 - Regional Anesthesia' },
      { value: '01.08', label: '01.08 - Vascular / Thoracic Anesthesia' },
    ]
  },
  {
    label: '02 - Community Medicine',
    options: [
      { value: '02.00', label: '02.00 - Community Medicine Specialty' },
      { value: '02.01', label: '02.01 - Community Health' },
    ]
  },
  {
    label: '03 - Dermatology',
    options: [
      { value: '03.00', label: '03.00 - Dermatology Specialty' },
      { value: '03.01', label: '03.01 - Dermatology Surgery' },
      { value: '03.02', label: '03.02 - Hair Implant Dermatology' },
      { value: '03.03', label: '03.03 - Pediatrics Dermatology' },
    ]
  },
  {
    label: '04 - Emergency Medicine',
    options: [
      { value: '04.00', label: '04.00 - Emergency Medicine Specialty' },
      { value: '04.01', label: '04.01 - Adult Emergency Medicine' },
      { value: '04.02', label: '04.02 - Pediatrics Emergency Medicine' },
    ]
  },
  {
    label: '05 - Ear, Nose & Throat (ENT)',
    options: [
      { value: '05.00', label: '05.00 - Ear, Nose & Throat Specialty' },
      { value: '05.01', label: '05.01 - Adult ENT' },
      { value: '05.02', label: '05.02 - Laryngology' },
      { value: '05.03', label: '05.03 - Neuro-Otology & Otology' },
      { value: '05.04', label: '05.04 - Nose, Ear Surgery' },
      { value: '05.05', label: '05.05 - Oral & Maxillofacial Surgery' },
      { value: '05.06', label: '05.06 - Otolaryngology' },
      { value: '05.07', label: '05.07 - Pediatrics ENT' },
      { value: '05.08', label: '05.08 - Pediatrics Otolaryngology' },
      { value: '05.09', label: '05.09 - Rhinology' },
      { value: '05.10', label: '05.10 - Audiology' },
    ]
  },
  {
    label: '06 - Family Medicine',
    options: [
      { value: '06.00', label: '06.00 - Family Medicine Specialty' },
      { value: '06.01', label: '06.01 - Family Medicine' },
      { value: '06.02', label: '06.02 - Primary Care / Ophthalmology' },
      { value: '06.03', label: '06.03 - Primary Care / Pulmonary' },
      { value: '06.04', label: '06.04 - Primary Care Preventive Pediatrics' },
      { value: '06.05', label: '06.05 - Primary Health Care' },
    ]
  },
  {
    label: '07 - Forensic Medicine',
    options: [
      { value: '07.00', label: '07.00 - Forensic Medicine Specialty' },
    ]
  },
  {
    label: '08 - Internal Medicine',
    options: [
      { value: '08.00', label: '08.00 - Internal Medicine Specialty' },
      { value: '08.01', label: '08.01 - Adolescent Medicine' },
      { value: '08.02', label: '08.02 - Cardiology' },
      { value: '08.03', label: '08.03 - Diabetics Medicine' },
      { value: '08.04', label: '08.04 - Endocrinology' },
      { value: '08.05', label: '08.05 - Gastrology/Gastroenterology' },
      { value: '08.06', label: '08.06 - Geriatrics' },
      { value: '08.07', label: '08.07 - Hematology' },
      { value: '08.08', label: '08.08 - Infectious Diseases' },
      { value: '08.09', label: '08.09 - Nephrology' },
      { value: '08.10', label: '08.10 - Nuclear Medicine' },
      { value: '08.11', label: '08.11 - Oncology' },
      { value: '08.12', label: '08.12 - Palliative Medicine' },
      { value: '08.13', label: '08.13 - Pulmonology/Chest Medicine' },
      { value: '08.14', label: '08.14 - Rheumatology' },
      { value: '08.15', label: '08.15 - Sleep Medicine' },
      { value: '08.16', label: '08.16 - Sport Medicine' },
      { value: '08.17', label: '08.17 - Hepatology' },
      { value: '08.18', label: '08.18 - Neurology' },
      { value: '08.19', label: '08.19 - Radiation Oncology' },
      { value: '08.20', label: '08.20 - Diabetes Foot Care' },
      { value: '08.21', label: '08.21 - Head & Neck Oncology' },
      { value: '08.22', label: '08.22 - Hematology - Stem Cell' },
      { value: '08.23', label: '08.23 - Congenital Heart Disease' },
      { value: '08.24', label: '08.24 - Bariatric Medicine' },
      { value: '08.25', label: '08.25 - Cardiothoracic' },
      { value: '08.26', label: '08.26 - General Medicine' },
    ]
  },
  {
    label: '09 - Microbiology',
    options: [
      { value: '09.00', label: '09.00 - Microbiology Specialty' },
    ]
  },
  {
    label: '10 - Obstetrics & Gynecology',
    options: [
      { value: '10.00', label: '10.00 - Obstetrics & Gynecology Specialty' },
      { value: '10.01', label: '10.01 - Gynecology Oncology' },
      { value: '10.02', label: '10.02 - Infertility' },
      { value: '10.03', label: '10.03 - IVF' },
      { value: '10.04', label: '10.04 - Perinatology' },
      { value: '10.05', label: '10.05 - Urogynecology' },
      { value: '10.06', label: '10.06 - Obstetrics' },
      { value: '10.07', label: '10.07 - Reproductive Endocrinology & Infertility' },
      { value: '10.08', label: '10.08 - Gynecology' },
      { value: '10.09', label: '10.09 - Maternal Fetal Medicine' },
    ]
  },
  {
    label: '11 - Ophthalmology',
    options: [
      { value: '11.00', label: '11.00 - Ophthalmology Specialty' },
      { value: '11.01', label: '11.01 - Comprehensive Ophthalmology' },
      { value: '11.02', label: '11.02 - Diseases & Surgery of the Retina' },
      { value: '11.03', label: '11.03 - Glaucoma' },
      { value: '11.04', label: '11.04 - Neuro-Ophthalmology' },
      { value: '11.05', label: '11.05 - Ocular Oncology' },
      { value: '11.06', label: '11.06 - Oculoplastic' },
      { value: '11.07', label: '11.07 - Ophthalmology' },
      { value: '11.08', label: '11.08 - Pediatrics Ophthalmology & Strabismus' },
      { value: '11.09', label: '11.09 - Primary Care / Ophthalmology' },
      { value: '11.10', label: '11.10 - Uveitis / Medical Retina' },
      { value: '11.11', label: '11.11 - Optometric' },
      { value: '11.12', label: '11.12 - Anterior Segment' },
      { value: '11.13', label: '11.13 - Anaplastology' },
      { value: '11.14', label: '11.14 - Macular Dystrophy' },
      { value: '11.15', label: '11.15 - Amblyopia' },
      { value: '11.16', label: '11.16 - Ophthalmic Photography' },
    ]
  },
  {
    label: '12 - Orthopedic',
    options: [
      { value: '12.00', label: '12.00 - Orthopedic Specialty' },
      { value: '12.01', label: '12.01 - Oncology Orthopedic' },
      { value: '12.02', label: '12.02 - Orthopedic Surgery' },
      { value: '12.03', label: '12.03 - Pediatrics Orthopedic' },
      { value: '12.04', label: '12.04 - Upper Limb Orthopedic' },
    ]
  },
  {
    label: '13 - Pathology',
    options: [
      { value: '13.00', label: '13.00 - Pathology Specialty' },
      { value: '13.01', label: '13.01 - Bone & Soft Tissue Pathology' },
      { value: '13.02', label: '13.02 - Dermatopathology' },
      { value: '13.03', label: '13.03 - Gast. & Hepat Pathology' },
      { value: '13.04', label: '13.04 - Histopathology' },
      { value: '13.05', label: '13.05 - Lymphoma Pathology' },
      { value: '13.06', label: '13.06 - Pathology Dermatology' },
      { value: '13.07', label: '13.07 - Renal Pathology' },
    ]
  },
  {
    label: '14 - Pediatric',
    options: [
      { value: '14.00', label: '14.00 - Pediatric Specialty' },
      { value: '14.01', label: '14.01 - Fetal Medicine' },
      { value: '14.02', label: '14.02 - Neonatal Intensive Care (NICU)' },
      { value: '14.03', label: '14.03 - Pediatrics Imaging' },
      { value: '14.04', label: '14.04 - Pediatrics Endocrinology' },
      { value: '14.05', label: '14.05 - Pediatrics Gastroenterology' },
      { value: '14.06', label: '14.06 - Pediatrics Genetics' },
      { value: '14.07', label: '14.07 - Pediatrics Rheumatology' },
      { value: '14.08', label: '14.08 - Pediatrics Sleep Medicine' },
      { value: '14.09', label: '14.09 - Pediatrics Orthopedic' },
      { value: '14.10', label: '14.10 - Pediatrics Hematology' },
      { value: '14.11', label: '14.11 - Pediatrics Infectious Diseases' },
      { value: '14.12', label: '14.12 - Pediatrics Intensive Care' },
      { value: '14.13', label: '14.13 - Pediatrics Nephrology' },
      { value: '14.14', label: '14.14 - Pediatrics Pulmonary Diseases' },
      { value: '14.15', label: '14.15 - Primary Care Preventive Pediatrics' },
      { value: '14.16', label: '14.16 - Pediatric Neurology' },
      { value: '14.17', label: '14.17 - Fetal Cardiology' },
      { value: '14.18', label: '14.18 - Neonatology' },
      { value: '14.19', label: '14.19 - Pediatric Allergy' },
      { value: '14.20', label: '14.20 - Pediatric Cardiology' },
    ]
  },
  {
    label: '15 - Pediatrics Surgery',
    options: [
      { value: '15.00', label: '15.00 - Pediatrics Surgery Specialty' },
      { value: '15.01', label: '15.01 - Pediatrics Cardiology' },
      { value: '15.02', label: '15.02 - Pediatrics Neurosurgery' },
      { value: '15.03', label: '15.03 - Pediatrics Oncology' },
      { value: '15.04', label: '15.04 - Pediatrics Plastic Surgery' },
      { value: '15.05', label: '15.05 - Pediatrics General Surgery' },
      { value: '15.06', label: '15.06 - Pediatrics Hematology/Oncology' },
    ]
  },
  {
    label: '16 - Physical Medicine & Rehabilitation',
    options: [
      { value: '16.00', label: '16.00 - Physical Medicine & Rehabilitation Specialty' },
      { value: '16.01', label: '16.01 - Physical Medicine & Rehabilitation' },
      { value: '16.02', label: '16.02 - Occupational Medicine' },
    ]
  },
  {
    label: '17 - Psychiatry',
    options: [
      { value: '17.00', label: '17.00 - Psychiatry Specialty' },
      { value: '17.01', label: '17.01 - Addiction Medicine' },
      { value: '17.02', label: '17.02 - Child / Adolescent Psychiatry' },
      { value: '17.03', label: '17.03 - Consultation - Liaison Psychiatry' },
      { value: '17.04', label: '17.04 - Forensic Psychiatry' },
      { value: '17.05', label: '17.05 - Geriatric Psychiatry' },
      { value: '17.06', label: '17.06 - Mental Health' },
      { value: '17.07', label: '17.07 - Mood Disorders Psychiatry' },
      { value: '17.08', label: '17.08 - Psychiatry' },
      { value: '17.09', label: '17.09 - Rehabilitation Psychiatry' },
      { value: '17.10', label: '17.10 - Schizophrenia' },
      { value: '17.11', label: '17.11 - Pediatric Behavior' },
      { value: '17.12', label: '17.12 - Youth Stress Reduction' },
    ]
  },
  {
    label: '18 - Radiology',
    options: [
      { value: '18.00', label: '18.00 - Radiology Specialty' },
      { value: '18.01', label: '18.01 - Body Imaging' },
      { value: '18.02', label: '18.02 - Breast Imaging' },
      { value: '18.03', label: '18.03 - Cardiac Imaging' },
      { value: '18.04', label: '18.04 - Chest Imaging' },
      { value: '18.05', label: '18.05 - Diagnostic Neuroradiology' },
      { value: '18.06', label: '18.06 - Diagnostic Radiology' },
      { value: '18.07', label: '18.07 - Emergency Radiology' },
      { value: '18.08', label: '18.08 - Interventional Neuroradiology' },
      { value: '18.09', label: '18.09 - Interventional Radiology' },
      { value: '18.10', label: '18.10 - Musculoskeletal Imaging' },
      { value: '18.11', label: '18.11 - Pediatrics Imaging' },
      { value: '18.12', label: '18.12 - Women\'s Imaging' },
    ]
  },
  {
    label: '19 - Surgery',
    options: [
      { value: '19.00', label: '19.00 - Surgery Specialty' },
      { value: '19.01', label: '19.01 - Arthroplasty Surgery' },
      { value: '19.02', label: '19.02 - Bariatric Surgery' },
      { value: '19.03', label: '19.03 - Cosmetic Surgery' },
      { value: '19.04', label: '19.04 - Craniofacial Surgery' },
      { value: '19.05', label: '19.05 - Endocrinology Surgery' },
      { value: '19.06', label: '19.06 - Facioplastic' },
      { value: '19.07', label: '19.07 - Foot & Ankle Surgery' },
      { value: '19.08', label: '19.08 - General Surgery' },
      { value: '19.09', label: '19.09 - Hand Surgery' },
      { value: '19.10', label: '19.10 - Hepatobiliary & Upper GI Surgery' },
      { value: '19.11', label: '19.11 - Neurosurgery (Spinal Surgery)' },
      { value: '19.12', label: '19.12 - Neurosurgery / Oncology' },
      { value: '19.13', label: '19.13 - Neurosurgery Vascular' },
      { value: '19.14', label: '19.14 - Plastic Surgery & Reconstruction' },
      { value: '19.15', label: '19.15 - Skull Base Surgery' },
      { value: '19.16', label: '19.16 - Spine Surgery' },
      { value: '19.17', label: '19.17 - Thoracic Surgery/Chest Surgery' },
      { value: '19.18', label: '19.18 - Trauma Surgery' },
      { value: '19.19', label: '19.19 - Vascular Surgery' },
      { value: '19.20', label: '19.20 - Colorectal Surgery' },
      { value: '19.21', label: '19.21 - Transplant Surgery' },
      { value: '19.22', label: '19.22 - Liver Transplant Surgery' },
      { value: '19.23', label: '19.23 - Renal and Pancreas Transplant Surgery' },
      { value: '19.24', label: '19.24 - Breast Surgery' },
      { value: '19.25', label: '19.25 - Cardiothoracic Surgery' },
      { value: '19.26', label: '19.26 - Burns' },
    ]
  },
  {
    label: '20 - Urology',
    options: [
      { value: '20.00', label: '20.00 - Urology Specialty' },
      { value: '20.01', label: '20.01 - Gynecology Urology' },
      { value: '20.02', label: '20.02 - Laparoscopic Urology' },
      { value: '20.03', label: '20.03 - Neuro-Urology' },
      { value: '20.04', label: '20.04 - Oncology Urology' },
      { value: '20.05', label: '20.05 - Pediatrics Urology' },
      { value: '20.06', label: '20.06 - Reconstruction Urology' },
    ]
  },
  {
    label: '21 - Critical Care',
    options: [
      { value: '21.00', label: '21.00 - Critical Care' },
      { value: '21.01', label: '21.01 - Pediatric Critical Care (PICU)' },
      { value: '21.02', label: '21.02 - Intensive Care (ICU)' },
    ]
  },
  {
    label: '22 - Dental',
    options: [
      { value: '22.00', label: '22.00 - Dental' },
      { value: '22.01', label: '22.01 - Pediatric Dental' },
      { value: '22.02', label: '22.02 - Prosthodontics' },
      { value: '22.03', label: '22.03 - Endodontics' },
      { value: '22.04', label: '22.04 - Periodontics' },
      { value: '22.05', label: '22.05 - Orthodontics' },
      { value: '22.06', label: '22.06 - Dental Implants' },
      { value: '22.07', label: '22.07 - Dental Hygiene' },
      { value: '22.08', label: '22.08 - Special Needs Dentistry' },
    ]
  },
  {
    label: '23 - Neurophysiology',
    options: [
      { value: '23.00', label: '23.00 - Neurophysiology' },
    ]
  },
  {
    label: '24 - Speech Pathology',
    options: [
      { value: '24.00', label: '24.00 - Speech/Speech Language Pathology' },
    ]
  },
  {
    label: '25 - Infection Control',
    options: [
      { value: '25.00', label: '25.00 - Infection Control' },
    ]
  },
];

