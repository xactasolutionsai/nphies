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
  // Institutional: Can use inpatient, daycase, and other classes
  institutional: ['inpatient', 'daycase', 'emergency', 'ambulatory', 'home', 'telemedicine'],
  
  // Professional: Can use outpatient, ambulatory, and other non-inpatient classes
  professional: ['outpatient', 'ambulatory', 'emergency', 'home', 'telemedicine'],
  
  // Dental (Oral): Must use ambulatory per NPHIES
  dental: ['ambulatory'],
  
  // Vision: NO ENCOUNTER REQUIRED per NPHIES IG
  // Vision Claims only contain: Patient, Provider, Diagnosis, Items, Benefit, Supporting Info
  vision: [],
  
  // Pharmacy: Similar to professional, uses ambulatory
  pharmacy: ['ambulatory', 'outpatient', 'emergency', 'home', 'telemedicine']
};

// Helper function to get filtered encounter class options based on auth type
export const getEncounterClassOptions = (authType) => {
  // Vision doesn't use Encounter at all
  if (authType === 'vision') {
    return [];
  }
  const allowed = ALLOWED_ENCOUNTER_CLASSES[authType] || ALLOWED_ENCOUNTER_CLASSES.professional;
  return ENCOUNTER_CLASS_OPTIONS.map(option => ({
    ...option,
    isDisabled: !allowed.includes(option.value)
  }));
};

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
export const BODY_SITE_OPTIONS_BY_AUTH_TYPE = {
  vision: VISION_BODY_SITE_OPTIONS,
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

export const SUPPORTING_INFO_CATEGORY_OPTIONS = [
  { value: 'info', label: 'General Info' },
  { value: 'days-supply', label: 'Days Supply' },
  { value: 'attachment', label: 'Attachment' },
  { value: 'clinical-notes', label: 'Clinical Notes' },
  { value: 'onset', label: 'Onset' },
  { value: 'related-claim', label: 'Related Claim' }
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

// NPHIES Investigation Result Options
export const INVESTIGATION_RESULT_OPTIONS = [
  { value: 'INP', label: 'Investigation(s) not performed' },
  { value: 'NAD', label: 'No abnormality detected' },
  { value: 'ABN', label: 'Abnormal results' }
];

// NPHIES Service Event Type Options (for dental/oral claims)
// Reference: http://nphies.sa/terminology/CodeSystem/service-event-type
export const SERVICE_EVENT_TYPE_OPTIONS = [
  { value: 'ICSE', label: 'ICSE - Initial client service event (New Visit)' },
  { value: 'SCSE', label: 'SCSE - Subsequent client service event (Follow-up)' }
];

