import { operationOutcomeErrors, claimResponseErrors } from '../../utils/nphiesErrors.js';
import { formatSaudiDateTime } from '../../utils/dateTime.js';
/**
 * NPHIES Prior Authorization Base Mapper
 * Contains shared utilities and resource builders used by all auth type mappers
 * Reference: https://portal.nphies.sa/ig/usecase-prior-authorizations.html
 */

import { randomUUID } from 'crypto';
import nphiesMapper from '../nphiesMapper.js';
import {
  claimIdentifierSystem, providerIdentifierSystem, requireProviderLicense, requireInsurerLicense,
  formatSaudiDate, mappingError, ICD10_SYSTEM, debugBundlesEnabled
} from './nphiesIdentity.js';

class BaseMapper {
  constructor() {
    this.generateId = () => randomUUID();
  }

  // ============================================
  // DATE FORMATTING UTILITIES
  // ============================================

  /**
   * Format date to FHIR date format (YYYY-MM-DD)
   * Handles timezone properly to avoid date shifting
   */
  formatDate(date) {
    // Plain YYYY-MM-DD passes through; instants are converted to the Riyadh calendar date
    // (slicing "2023-12-03T21:00:00Z" would give 12-03, but it is 12-04 in Saudi Arabia).
    return formatSaudiDate(date);
  }

  /**
   * Format datetime to FHIR dateTime format
   */
  formatDateTime(date) {
    if (!date) return new Date().toISOString();
    return new Date(date).toISOString();
  }

  /**
   * Format datetime with Saudi Arabia timezone (+03:00)
   * NPHIES SS/IMP encounters require this format: "2023-12-04T10:25:00+03:00"
   * Reference: https://portal.nphies.sa/ig/Encounter-10124.json.html
   */
  formatDateTimeWithTimezone(date) {
    return formatSaudiDateTime(date);
  }

  // ============================================
  // PROFILE URL GETTERS
  // ============================================

  /**
   * Get the NPHIES Authorization profile URL based on auth type
   * Override in child classes for specific auth types
   */
  getAuthorizationProfileUrl(authType) {
    const profiles = {
      'institutional': 'http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/institutional-priorauth|1.0.0',
      'professional': 'http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/professional-priorauth|1.0.0',
      'pharmacy': 'http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/pharmacy-priorauth|1.0.0',
      'dental': 'http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/oral-priorauth|1.0.0',
      'vision': 'http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/vision-priorauth|1.0.0'
    };
    return profiles[authType] || profiles['professional'];
  }

  /**
   * Get the NPHIES Encounter profile URL based on encounter class
   * All encounter types use the generic encounter profile per NPHIES documentation
   */
  getEncounterProfileUrl(encounterClass) {
    // All encounter classes use the same generic encounter profile
    // Per NPHIES examples: http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/encounter|1.0.0
    return 'http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/encounter|1.0.0';
  }

  /**
   * Get encounter class code for FHIR
   */
  getEncounterClassCode(encounterClass) {
    const codes = {
      'ambulatory': 'AMB',
      'outpatient': 'AMB',
      'emergency': 'EMER',
      'home': 'HH',
      'inpatient': 'IMP',
      'daycase': 'SS',
      'telemedicine': 'VR'
    };
    return codes[encounterClass] || 'AMB';
  }

  /**
   * Get display text for encounter class
   */
  getEncounterClassDisplay(encounterClass) {
    const displays = {
      'ambulatory': 'ambulatory',
      'outpatient': 'ambulatory',
      'emergency': 'emergency',
      'home': 'home health',
      'inpatient': 'inpatient encounter',
      'daycase': 'short stay',
      'telemedicine': 'virtual'
    };
    return displays[encounterClass] || 'ambulatory';
  }

  // ============================================
  // CODE SYSTEM HELPERS
  // ============================================

  /**
   * Get claim type code based on auth type
   */
  getClaimTypeCode(authType) {
    const types = {
      'institutional': 'institutional',
      'professional': 'professional',
      'pharmacy': 'pharmacy',
      'dental': 'oral',
      'vision': 'vision'
    };
    return types[authType] || 'professional';
  }

  /**
   * Get claim subType code based on encounter class
   * Override in child classes for specific auth types
   */
  getClaimSubTypeCode(encounterClass, authType) {
    const subTypes = {
      'inpatient': 'ip',
      'outpatient': 'op',
      'daycase': 'ip',
      'emergency': 'emr',
      'ambulatory': 'op',
      'home': 'op',
      'telemedicine': 'op'
    };
    return subTypes[encounterClass] || 'op';
  }

  /**
   * Convert unit text to UCUM code
   * Reference: http://unitsofmeasure.org
   */
  getUCUMCode(unit) {
    if (!unit) return '';
    
    const ucumMap = {
      'mmHg': 'mm[Hg]', 'mm[Hg]': 'mm[Hg]', 'mmhg': 'mm[Hg]',
      'cm': 'cm', 'centimeter': 'cm', 'centimeters': 'cm',
      'm': 'm', 'meter': 'm', 'meters': 'm',
      'kg': 'kg', 'kilogram': 'kg', 'kilograms': 'kg',
      'g': 'g', 'gram': 'g', 'grams': 'g',
      '/min': '/min', 'per minute': '/min', 'bpm': '/min',
      'beats per minute': '/min', 'breaths per minute': '/min',
      'Cel': 'Cel', 'celsius': 'Cel', '°C': 'Cel', 'C': 'Cel',
      '%': '%', 'percent': '%',
      'd': 'd', 'day': 'd', 'days': 'd',
      'h': 'h', 'hour': 'h', 'hours': 'h',
      'mL': 'mL', 'ml': 'mL', 'milliliter': 'mL',
      'L': 'L', 'liter': 'L'
    };

    return ucumMap[unit] || unit;
  }

  /**
   * Get the valid NPHIES supportingInfo category code
   */
  getNphiesSupportingInfoCategory(category) {
    const categoryMap = {
      'vital-sign-systolic': 'vital-sign-systolic',
      'vital-sign-diastolic': 'vital-sign-diastolic',
      'vital-sign-height': 'vital-sign-height',
      'vital-sign-weight': 'vital-sign-weight',
      'pulse': 'pulse',
      'temperature': 'temperature',
      'oxygen-saturation': 'oxygen-saturation',
      'respiratory-rate': 'respiratory-rate',
      'admission-weight': 'admission-weight',
      'estimated-length-of-stay': 'estimated-Length-of-Stay',
      'hospitalized': 'hospitalized',
      'icu-hours': 'icu-hours',
      'ventilation-hours': 'ventilation-hours',
      'chief-complaint': 'chief-complaint',
      'patient-history': 'patient-history',
      'investigation-result': 'investigation-result',
      'treatment-plan': 'treatment-plan',
      'physical-examination': 'physical-examination',
      'history-of-present-illness': 'history-of-present-illness',
      'reason-for-visit': 'reason-for-visit',
      'missingtooth': 'missingtooth',
      'missing-tooth': 'missingtooth',
      'last-menstrual-period': 'last-menstrual-period',
      'birth-weight': 'birth-weight',
      'onset': 'onset',
      'attachment': 'attachment',
      'days-supply': 'days-supply',
      'info': 'info',
      'lab-test': 'lab-test',
      'morphology': 'morphology',
      'employmentimpacted': 'employmentImpacted',
      'employment-impacted': 'employmentImpacted',
      'prosthesis': 'prosthesis',
      'radiology': 'radiology',
      'discharge': 'discharge'
    };
    
    const normalizedCategory = (category || '').toLowerCase();
    return categoryMap[normalizedCategory] || category;
  }

  /**
   * Get the appropriate code system for supportingInfo based on category
   */
  getSupportingInfoCodeSystem(category) {
    const systems = {
      'chief-complaint': 'http://snomed.info/sct',
      'investigation-result': 'http://nphies.sa/terminology/CodeSystem/investigation-result',
      'onset': ICD10_SYSTEM, // BV-00428: Onset requires ICD-10 code for symptoms/illness
      'hospitalized': 'http://snomed.info/sct'
    };
    return systems[category] || 'http://nphies.sa/terminology/CodeSystem/supporting-info-code';
  }

  // ============================================
  // DISPLAY TEXT HELPERS
  // ============================================

  /**
   * Get display text for coverage type codes
   */
  getCoverageTypeDisplay(code) {
    const displays = {
      'EHCPOL': 'Extended healthcare',
      'PUBLICPOL': 'Public healthcare',
      'DENTAL': 'Dental',
      'VISION': 'Vision',
      'MENTPRG': 'Mental health program'
    };
    return displays[code] || code;
  }

  /**
   * Get display text for relationship codes
   */
  getRelationshipDisplay(code) {
    const displays = {
      'self': 'Self',
      'spouse': 'Spouse',
      'child': 'Child',
      'parent': 'Parent',
      'common': 'Common Law Spouse',
      'other': 'Other',
      'injured': 'Injured Party'
    };
    return displays[code] || code;
  }

  /**
   * Get service type display name
   */
  getServiceTypeDisplay(code) {
    const displays = {
      'acute-care': 'Acute Care',
      'sub-acute-care': 'Sub-Acute Care',
      'rehabilitation': 'Rehabilitation',
      'mental-behavioral': 'Mental & Behavioral',
      'geriatric-care': 'Geriatric Care',
      'newborn': 'Newborn',
      'family-planning': 'Family Planning',
      'dental-care': 'Dental Care',
      'palliative-care': 'Palliative Care',
      'others': 'Others',
      'unknown': 'Unknown'
    };
    return displays[code] || code;
  }

  /**
   * Get body site display name
   */
  getBodySiteDisplay(code) {
    const displays = {
      'RIV': 'Right eye', 'LIV': 'Left eye',
      'E3': 'Upper right, eyelid', 'E4': 'Lower right, eyelid',
      'FA': 'Left hand, thumb', 'F1': 'Left hand, second digit',
      'F2': 'Left hand, third digit', 'F3': 'Left hand, fourth digit',
      'F4': 'Left hand, fifth digit', 'F5': 'Right hand, thumb',
      'F6': 'Right hand, second digit', 'F7': 'Right hand, third digit',
      'F8': 'Right hand, fourth digit', 'F9': 'Right hand, fifth digit',
      'TA': 'Left foot, great toe', 'T1': 'Left foot, second digit',
      'T2': 'Left foot, third digit', 'T3': 'Left foot, fourth digit',
      'T4': 'Left foot, fifth digit', 'T5': 'Right foot, great toe',
      'T6': 'Right foot, second digit', 'T7': 'Right foot, third digit',
      'T8': 'Right foot, fourth digit', 'T9': 'Right foot, fifth digit',
      'LC': 'Left circumflex coronary artery',
      'LD': 'Left anterior descending coronary artery',
      'LM': 'Left main coronary artery',
      'RC': 'Right coronary artery',
      'RI': 'Ramus intermedius coronary artery',
      'LT': 'Left side', 'RT': 'Right side'
    };
    return displays[code] || code;
  }

  /**
   * Get practice code display name
   * Reference: http://nphies.sa/terminology/CodeSystem/practice-codes
   */
  getPracticeCodeDisplay(code) {
    const displays = {
      // Anesthesiology
      '01.00': 'Anesthesiology Specialty',
      '01.01': 'Ambulatory Anesthesia',
      '01.02': 'Anesthesia Cardiology',
      '01.03': 'Neuro-Anesthesia',
      '01.04': 'Obstetrics Anesthesia',
      '01.05': 'Pediatrics Anesthesia',
      '01.06': 'Pediatrics Cardiac Anesthesia',
      '01.07': 'Regional Anesthesia',
      '01.08': 'Vascular / Thoracic Anesthesia',
      // Community Medicine
      '02.00': 'Community Medicine Specialty',
      '02.01': 'Community Health',
      // Dermatology
      '03.00': 'Dermatology Specialty',
      '03.01': 'Dermatology Surgery',
      '03.02': 'Hair Implant Dermatology',
      '03.03': 'Pediatrics Dermatology',
      // Emergency Medicine
      '04.00': 'Emergency Medicine Specialty',
      '04.01': 'Adult Emergency Medicine',
      '04.02': 'Pediatrics Emergency Medicine',
      // ENT
      '05.00': 'Ear, Nose & Throat Specialty',
      '05.01': 'Adult ENT',
      '05.02': 'Laryngology',
      '05.03': 'Neuro-Otology & Otology',
      '05.04': 'Nose, Ear Surgery',
      '05.05': 'Oral & Maxillofacial Surgery',
      '05.06': 'Otolaryngology',
      '05.07': 'Pediatrics ENT',
      '05.08': 'Pediatrics Otolaryngology',
      '05.09': 'Rhinology',
      '05.10': 'Audiology',
      // Family Medicine
      '06.00': 'Family Medicine Specialty',
      '06.01': 'Family Medicine',
      '06.02': 'Primary Care / Ophthalmology',
      '06.03': 'Primary Care / Pulmonary',
      '06.04': 'Primary Care Preventive Pediatrics',
      '06.05': 'Primary Health Care',
      // Forensic Medicine
      '07.00': 'Forensic Medicine Specialty',
      // Internal Medicine
      '08.00': 'Internal Medicine Specialty',
      '08.01': 'Adolescent Medicine',
      '08.02': 'Cardiology',
      '08.03': 'Diabetics Medicine',
      '08.04': 'Endocrinology',
      '08.05': 'Gastrology/Gastroenterology',
      '08.06': 'Geriatrics',
      '08.07': 'Hematology',
      '08.08': 'Infectious Diseases',
      '08.09': 'Nephrology',
      '08.10': 'Nuclear Medicine',
      '08.11': 'Oncology',
      '08.12': 'Palliative Medicine',
      '08.13': 'Pulmonology/Chest Medicine',
      '08.14': 'Rheumatology',
      '08.15': 'Sleep Medicine',
      '08.16': 'Sport Medicine',
      '08.17': 'Hepatology',
      '08.18': 'Neurology',
      '08.19': 'Radiation Oncology',
      '08.20': 'Diabetes Foot Care',
      '08.21': 'Head & Neck Oncology',
      '08.22': 'Hematology - Stem Cell',
      '08.23': 'Congenital Heart Disease',
      '08.24': 'Bariatric Medicine',
      '08.25': 'Cardiothoracic',
      '08.26': 'General Medicine',
      // Microbiology
      '09.00': 'Microbiology Specialty',
      // OB/GYN
      '10.00': 'Obstetrics & Gynecology Specialty',
      '10.01': 'Gynecology Oncology',
      '10.02': 'Infertility',
      '10.03': 'IVF',
      '10.04': 'Perinatology',
      '10.05': 'Urogynecology',
      '10.06': 'Obstetrics',
      '10.07': 'Reproductive Endocrinology & Infertility',
      '10.08': 'Gynecology',
      '10.09': 'Maternal Fetal Medicine',
      // Ophthalmology
      '11.00': 'Ophthalmology Specialty',
      '11.01': 'Comprehensive Ophthalmology',
      '11.02': 'Diseases & Surgery of the Retina',
      '11.03': 'Glaucoma',
      '11.04': 'Neuro-Ophthalmology',
      '11.05': 'Ocular Oncology',
      '11.06': 'Oculoplastic',
      '11.07': 'Ophthalmology',
      '11.08': 'Pediatrics Ophthalmology & Strabismus',
      '11.09': 'Primary Care / Ophthalmology',
      '11.10': 'Uveitis / Medical Retina',
      '11.11': 'Optometric',
      '11.12': 'Anterior Segment',
      '11.13': 'Anaplastology',
      '11.14': 'Macular Dystrophy',
      '11.15': 'Amblyopia',
      '11.16': 'Ophthalmic Photography',
      // Orthopedic
      '12.00': 'Orthopedic Specialty',
      '12.01': 'Oncology Orthopedic',
      '12.02': 'Orthopedic Surgery',
      '12.03': 'Pediatrics Orthopedic',
      '12.04': 'Upper Limb Orthopedic',
      // Pathology
      '13.00': 'Pathology Specialty',
      '13.01': 'Bone & Soft Tissue Pathology',
      '13.02': 'Dermatopathology',
      '13.03': 'Gast. & Hepat Pathology',
      '13.04': 'Histopathology',
      '13.05': 'Lymphoma Pathology',
      '13.06': 'Pathology Dermatology',
      '13.07': 'Renal Pathology',
      // Pediatric
      '14.00': 'Pediatric Specialty',
      '14.01': 'Fetal Medicine',
      '14.02': 'Neonatal Intensive Care (NICU)',
      '14.03': 'Pediatrics Imaging',
      '14.04': 'Pediatrics Endocrinology',
      '14.05': 'Pediatrics Gastroenterology',
      '14.06': 'Pediatrics Genetics',
      '14.07': 'Pediatrics Rheumatology',
      '14.08': 'Pediatrics Sleep Medicine',
      '14.09': 'Pediatrics Orthopedic',
      '14.10': 'Pediatrics Hematology',
      '14.11': 'Pediatrics Infectious Diseases',
      '14.12': 'Pediatrics Intensive Care',
      '14.13': 'Pediatrics Nephrology',
      '14.14': 'Pediatrics Pulmonary Diseases',
      '14.15': 'Primary Care Preventive Pediatrics',
      '14.16': 'Pediatric Neurology',
      '14.17': 'Fetal Cardiology',
      '14.18': 'Neonatology',
      '14.19': 'Pediatric Allergy',
      '14.20': 'Pediatric Cardiology',
      // Pediatrics Surgery
      '15.00': 'Pediatrics Surgery Specialty',
      '15.01': 'Pediatrics Cardiology',
      '15.02': 'Pediatrics Neurosurgery',
      '15.03': 'Pediatrics Oncology',
      '15.04': 'Pediatrics Plastic Surgery',
      '15.05': 'Pediatrics General Surgery',
      '15.06': 'Pediatrics Hematology/Oncology',
      // Physical Medicine
      '16.00': 'Physical Medicine & Rehabilitation Specialty',
      '16.01': 'Physical Medicine & Rehabilitation',
      '16.02': 'Occupational Medicine',
      // Psychiatry
      '17.00': 'Psychiatry Specialty',
      '17.01': 'Addiction Medicine',
      '17.02': 'Child / Adolescent Psychiatry',
      '17.03': 'Consultation - Liaison Psychiatry',
      '17.04': 'Forensic Psychiatry',
      '17.05': 'Geriatric Psychiatry',
      '17.06': 'Mental Health',
      '17.07': 'Mood Disorders Psychiatry',
      '17.08': 'Psychiatry',
      '17.09': 'Rehabilitation Psychiatry',
      '17.10': 'Schizophrenia',
      '17.11': 'Pediatric Behavior',
      '17.12': 'Youth Stress Reduction',
      // Radiology
      '18.00': 'Radiology Specialty',
      '18.01': 'Body Imaging',
      '18.02': 'Breast Imaging',
      '18.03': 'Cardiac Imaging',
      '18.04': 'Chest Imaging',
      '18.05': 'Diagnostic Neuroradiology',
      '18.06': 'Diagnostic Radiology',
      '18.07': 'Emergency Radiology',
      '18.08': 'Interventional Neuroradiology',
      '18.09': 'Interventional Radiology',
      '18.10': 'Musculoskeletal Imaging',
      '18.11': 'Pediatrics Imaging',
      '18.12': 'Women\'s Imaging',
      // Surgery
      '19.00': 'Surgery Specialty',
      '19.01': 'Arthroplasty Surgery',
      '19.02': 'Bariatric Surgery',
      '19.03': 'Cosmetic Surgery',
      '19.04': 'Craniofacial Surgery',
      '19.05': 'Endocrinology Surgery',
      '19.06': 'Facioplastic',
      '19.07': 'Foot & Ankle Surgery',
      '19.08': 'General Surgery',
      '19.09': 'Hand Surgery',
      '19.10': 'Hepatobiliary & Upper GI Surgery',
      '19.11': 'Neurosurgery (Spinal Surgery)',
      '19.12': 'Neurosurgery / Oncology',
      '19.13': 'Neurosurgery Vascular',
      '19.14': 'Plastic Surgery & Reconstruction',
      '19.15': 'Skull Base Surgery',
      '19.16': 'Spine Surgery',
      '19.17': 'Thoracic Surgery/Chest Surgery',
      '19.18': 'Trauma Surgery',
      '19.19': 'Vascular Surgery',
      '19.20': 'Colorectal Surgery',
      '19.21': 'Transplant Surgery',
      '19.22': 'Liver Transplant Surgery',
      '19.23': 'Renal and Pancreas Transplant Surgery',
      '19.24': 'Breast Surgery',
      '19.25': 'Cardiothoracic Surgery',
      '19.26': 'Burns',
      // Urology
      '20.00': 'Urology Specialty',
      '20.01': 'Gynecology Urology',
      '20.02': 'Laparoscopic Urology',
      '20.03': 'Neuro-Urology',
      '20.04': 'Oncology Urology',
      '20.05': 'Pediatrics Urology',
      '20.06': 'Reconstruction Urology',
      // Critical Care
      '21.00': 'Critical Care',
      '21.01': 'Pediatric Critical Care (PICU)',
      '21.02': 'Intensive Care (ICU)',
      // Dental
      '22.00': 'Dental',
      '22.01': 'Pediatric Dental',
      '22.02': 'Prosthodontics',
      '22.03': 'Endodontics',
      '22.04': 'Periodontics',
      '22.05': 'Orthodontics',
      '22.06': 'Dental Implants',
      '22.07': 'Dental Hygiene',
      '22.08': 'Special Needs Dentistry',
      // Other
      '23.00': 'Neurophysiology',
      '24.00': 'Speech/Speech Language Pathology',
      '25.00': 'Infection Control'
    };
    return displays[code] || 'Healthcare Professional';
  }

  /**
   * Get admit source display name
   * Reference: http://nphies.sa/terminology/CodeSystem/admit-source
   */
  getAdmitSourceDisplay(code) {
    const displays = {
      'IA': 'Immediate Admission',
      'EPH': 'Emergency Admission by referral from private hospital',
      'EER': 'Admission from hospital ER',
      'EWIS': 'Elective waiting list admission insurance coverage Scheme',
      'EPPHC': 'Emergency Admission by referral from private primary healthcare center',
      'EOP': 'Emergency Admission from hospital outpatient',
      'PMBA': 'Planned Maternity Birth Admission',
      'EGGH': 'Emergency Admission by referral from general government hospital',
      'PVAMB': 'Private ambulance',
      'WKIN': 'Walk-in',
      'EMBA': 'Emergency Maternity Birth Admission',
      'EWSS': 'Elective waiting list admission self-payment Scheme',
      'Others': 'Others',
      'EWGS': 'Elective waiting list admission government free Scheme',
      'EIC': 'Emergency Admission by insurance company',
      'EGPHC': 'Emergency Admission by referral from government primary healthcare center',
      'FMLYM': 'Family member',
      'AA': 'Already admitted',
      'RECR': 'Red crescent',
      'AAIC': 'Already admitted- insurance consumed'
    };
    return displays[code] || code;
  }

  /**
   * Get display text for practitioner identifier type codes
   */
  getPractitionerIdentifierTypeDisplay(code) {
    const displays = {
      'MD': 'Medical License Number',
      'NPI': 'National Provider Identifier',
      'PRN': 'Provider Number',
      'TAX': 'Tax ID Number',
      'DN': 'Doctor Number',
      'NIIP': 'National Insurance Payor Identifier'
    };
    return displays[code] || 'License Number';
  }

  // ============================================
  // IDENTIFIER HELPERS
  // ============================================

  /** Claim.use sent by this mapper; claim mappers override with 'claim'. */
  getClaimUse() {
    return 'preauthorization';
  }

  /** Base identifier system for provider-owned identifiers (shared with communications). */
  getProviderIdentifierSystem(provider) {
    return providerIdentifierSystem(provider);
  }

  /**
   * System of the submitted Claim.identifier. Cancel and status-check Task.focus and
   * Communication.about must use exactly this value.
   */
  getClaimIdentifierSystem(provider, use = this.getClaimUse()) {
    return claimIdentifierSystem(provider, use);
  }

  // ============================================
  // SUPPORTING INFO SEQUENCING
  // ============================================

  /**
   * Remember each caller-supplied supportingInfo entry's own sequence (or position) before
   * mappers add, remove or reorder entries, so item.information_sequences can be remapped.
   */
  tagCallerSupportingInfo(supportingInfo) {
    return (supportingInfo || []).map((info, idx) => ({
      ...info,
      _callerSequence: info.sequence ?? idx + 1
    }));
  }

  /** Map of caller sequence -> final sequence for a numbered supportingInfo list. */
  buildInformationSequenceMap(finalEntries) {
    const map = new Map();
    finalEntries.forEach(({ info, sequence }) => {
      const callerSequence = Number(info?._callerSequence);
      if (Number.isFinite(callerSequence) && !map.has(callerSequence)) map.set(callerSequence, sequence);
    });
    return map;
  }

  /**
   * Resolve an item's informationSequence. Caller sequences are translated to the renumbered
   * supportingInfo; references to entries that were dropped are removed.
   */
  resolveInformationSequences(item, supportingInfoSequences, sequenceMap) {
    const requested = item?.information_sequences;
    if (!Array.isArray(requested) || requested.length === 0) {
      return supportingInfoSequences?.length ? supportingInfoSequences : undefined;
    }
    if (!sequenceMap) return requested;
    const mapped = [...new Set(requested.map(seq => sequenceMap.get(Number(seq))).filter(seq => seq !== undefined))];
    return mapped.length ? mapped : undefined;
  }

  // ============================================
  // RESOURCE BUILDERS - Common resources shared across all auth types
  // ============================================

  /**
   * Build Patient resource with specific ID for bundle consistency
   */
  buildPatientResourceWithId(patient, patientId) {
    const patientResource = nphiesMapper.buildPatientResource(patient);
    patientResource.resource.id = patientId;
    patientResource.fullUrl = `http://provider.com/Patient/${patientId}`;
    return patientResource;
  }

  /**
   * Build Provider Organization with specific ID for bundle consistency
   */
  buildProviderOrganizationWithId(provider, providerId) {
    const providerResource = nphiesMapper.buildProviderOrganization(provider);
    providerResource.resource.id = providerId;
    providerResource.fullUrl = `http://provider.com/Organization/${providerId}`;
    return providerResource;
  }

  /**
   * Build the facility Location (Claim.facility must reference a Location, not an Organization).
   * Returns null when the provider has no location license; callers then omit Claim.facility.
   */
  buildFacilityLocationWithId(provider, locationId, providerId) {
    const locationResource = nphiesMapper.buildLocationResource(provider);
    if (!locationResource) return null;
    locationResource.resource.id = locationId;
    locationResource.fullUrl = `http://provider.com/Location/${locationId}`;
    locationResource.resource.managingOrganization = { reference: `Organization/${providerId}` };
    return locationResource;
  }

  /**
   * Build Insurer Organization with specific ID for bundle consistency
   */
  buildInsurerOrganizationWithId(insurer, insurerId) {
    const insurerResource = nphiesMapper.buildPayerOrganization(insurer);
    insurerResource.resource.id = insurerId;
    insurerResource.fullUrl = `http://provider.com/Organization/${insurerId}`;
    return insurerResource;
  }

  /**
   * Build Coverage resource with consistent IDs
   * Supports newborn requests where subscriber = mother, beneficiary = newborn
   * @param {Object} coverage - Coverage data
   * @param {Object} patient - Patient data (newborn patient in newborn cases)
   * @param {Object} insurer - Insurer data
   * @param {Object} policyHolder - PolicyHolder Organization data (optional)
   * @param {Object} bundleResourceIds - Resource IDs for bundle
   * @param {Object} motherPatient - Mother patient data (optional, for newborn requests)
   * @param {String} motherPatientId - Mother patient ID in bundle (optional, for newborn requests)
   */
  buildCoverageResourceWithId(coverage, patient, insurer, policyHolder, bundleResourceIds, motherPatient = null, motherPatientId = null) {
    const coverageId = bundleResourceIds.coverage;
    const patientId = bundleResourceIds.patient;
    const insurerId = bundleResourceIds.insurer;

    // For newborn cases: subscriber = mother, beneficiary = newborn
    // Per NPHIES example: Newborn Elig Request.json
    const subscriberPatientId = (motherPatient && motherPatientId) ? motherPatientId : patientId;
    const beneficiaryPatientId = patientId; // Always the newborn/primary patient
    const relationshipCode = (motherPatient && motherPatientId) ? 'child' : (coverage?.relationship || 'self');
    // policyHolder is either an Organization (employer) or the subscribing Patient
    const policyHolderReference = policyHolder?.id
      ? `Organization/${policyHolder.id}`
      : `Patient/${(motherPatient && motherPatientId) ? motherPatientId : patientId}`;
    const memberId = coverage?.member_id || coverage?.memberId;
    if (!memberId) {
      throw mappingError('Coverage member ID (coverage.member_id) is required');
    }
    const isActive = coverage?.is_active ?? coverage?.isActive ?? true;
    const planValue = coverage?.plan_id || coverage?.class_value || coverage?.plan_value;
    const planName = coverage?.plan_name || coverage?.class_name;

    const coverageResource = {
      resourceType: 'Coverage',
      id: coverageId,
      meta: {
        profile: ['http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/coverage|1.0.0']
      },
      identifier: [
        {
          system: 'http://payer.com/memberid',
          value: String(memberId)
        }
      ],
      status: isActive === false ? 'cancelled' : 'active',
      type: {
        coding: [
          {
            system: 'http://nphies.sa/terminology/CodeSystem/coverage-type',
            code: coverage?.coverage_type || coverage?.type || 'EHCPOL',
            display: this.getCoverageTypeDisplay(coverage?.coverage_type || coverage?.type || 'EHCPOL')
          }
        ]
      },
      policyHolder: {
        reference: policyHolderReference
      },
      subscriber: {
        reference: `Patient/${subscriberPatientId}`
      },
      beneficiary: {
        reference: `Patient/${beneficiaryPatientId}`
      },
      relationship: {
        coding: [
          {
            system: 'http://terminology.hl7.org/CodeSystem/subscriber-relationship',
            code: relationshipCode,
            display: this.getRelationshipDisplay(relationshipCode)
          }
        ]
      },
      payor: [
        {
          reference: `Organization/${insurerId}`
        }
      ]
    };

    // Plan class only when the plan is known (no 'default-plan' placeholder)
    if (planValue || planName) {
      coverageResource.class = [
        {
          type: {
            coding: [
              {
                system: 'http://terminology.hl7.org/CodeSystem/coverage-class',
                code: 'plan'
              }
            ]
          },
          value: String(planValue || planName),
          ...(planName && { name: planName })
        }
      ];
    }

    if (coverage?.period_start || coverage?.start_date) {
      coverageResource.period = {
        start: this.formatDate(coverage.period_start || coverage.start_date)
      };
      if (coverage?.period_end || coverage?.end_date) {
        coverageResource.period.end = this.formatDate(coverage.period_end || coverage.end_date);
      }
    }

    // Note: The 'network' code from http://terminology.hl7.org/CodeSystem/coverage-class
    // is NOT valid in the NPHIES ValueSet (IB-00242 error).
    // NPHIES only accepts: 'group', 'subgroup', 'plan', 'subplan', 'class', 'subclass', 
    // 'sequence', 'rxbin', 'rxpcn', 'rxid', 'rxgroup'.
    // We store network info in a comment/extension instead, or skip it entirely.
    // If network data is needed, consider using a NPHIES-specific extension.
    // For now, we skip adding the network class to avoid validation errors.

    return {
      fullUrl: `http://provider.com/Coverage/${coverageId}`,
      resource: coverageResource
    };
  }

  /**
   * Build Practitioner resource with specific ID
   */
  buildPractitionerResourceWithId(practitioner, practitionerId) {
    const pract = practitioner || {};
    const license = pract.license_number || pract.nphies_id;
    if (!license) {
      throw mappingError('Practitioner license (practitioner.license_number) is required for the care team');
    }
    const specialtyCode = pract.specialty_code || pract.practice_code;
    const name = pract.name || pract.full_name;

    return {
      fullUrl: `http://provider.com/Practitioner/${practitionerId}`,
      resource: {
        resourceType: 'Practitioner',
        id: practitionerId,
        meta: {
          profile: ['http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/practitioner|1.0.0']
        },
        identifier: [
          {
            type: {
              coding: [
                {
                  system: 'http://terminology.hl7.org/CodeSystem/v2-0203',
                  code: pract.identifier_type || 'MD',
                  display: this.getPractitionerIdentifierTypeDisplay(pract.identifier_type || 'MD')
                }
              ]
            },
            system: 'http://nphies.sa/license/practitioner-license',
            value: String(license)
          }
        ],
        active: true,
        // Only the practitioner's real name and specialty; no placeholder values
        ...((name || pract.family_name) && {
          name: [
            {
              use: 'official',
              ...(name && { text: name }),
              family: pract.family_name || name.split(' ').pop(),
              given: pract.given_name ? [pract.given_name] : [(name || pract.family_name).split(' ')[0]]
            }
          ]
        }),
        ...(specialtyCode && {
          qualification: [
            {
              code: {
                coding: [
                  {
                    system: 'http://nphies.sa/terminology/CodeSystem/practice-codes',
                    code: specialtyCode,
                    display: pract.specialty_display || this.getPracticeCodeDisplay(specialtyCode)
                  }
                ]
              }
            }
          ]
        })
      }
    };
  }

  /**
   * Build FHIR MessageHeader for Prior Authorization Request
   */
  buildMessageHeader(provider, insurer, focusFullUrl) {
    const messageHeaderId = this.generateId();
    const senderNphiesId = requireProviderLicense(provider);
    const destinationNphiesId = requireInsurerLicense(insurer);

    return {
      fullUrl: `urn:uuid:${messageHeaderId}`,
      resource: {
        resourceType: 'MessageHeader',
        id: messageHeaderId,
        meta: {
          profile: ['http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/message-header|1.0.0']
        },
        eventCoding: {
          system: 'http://nphies.sa/terminology/CodeSystem/ksa-message-events',
          code: 'priorauth-request'
        },
        destination: [
          {
            endpoint: `http://nphies.sa/license/payer-license/${destinationNphiesId}`,
            receiver: {
              type: 'Organization',
              identifier: {
                system: 'http://nphies.sa/license/payer-license',
                value: destinationNphiesId
              }
            }
          }
        ],
        sender: {
          type: 'Organization',
          identifier: {
            system: 'http://nphies.sa/license/provider-license',
            value: senderNphiesId
          }
        },
        source: {
          endpoint: 'http://provider.com'
        },
        focus: [
          {
            reference: focusFullUrl
          }
        ]
      }
    };
  }

  /**
   * Build FHIR Binary resource for attachments
   */
  buildBinaryResource(attachment) {
    const binaryId = attachment.binary_id || `binary-${this.generateId()}`;
    
    return {
      fullUrl: `http://provider.com/Binary/${binaryId}`,
      resource: {
        resourceType: 'Binary',
        id: binaryId,
        meta: {}, // Binary resources require meta but typically don't have profiles
        contentType: attachment.content_type,
        data: attachment.base64_content
      }
    };
  }

  // ============================================
  // SUPPORTING INFO BUILDER
  // ============================================

  /**
   * Build supportingInfo element following NPHIES specification
   */
  buildSupportingInfo(info) {
    const categoryCode = this.getNphiesSupportingInfoCategory(info.category);
    
    const supportingInfo = {
      sequence: info.sequence,
      category: {
        coding: [
          {
            system: info.category_system || 'http://nphies.sa/terminology/CodeSystem/claim-information-category',
            code: categoryCode
          }
        ]
      }
    };

    // Add code if present
    // IMPORTANT: Per NPHIES BV-00530, code.text is ONLY allowed for 'chief-complaint' category
    // For other categories, if you include a 'code' element, it MUST have code.coding with a proper system/code
    const category = (info.category || '').toLowerCase();
    const isChiefComplaint = category === 'chief-complaint';
    
    // BV-00531: For chief-complaint, the code element is REQUIRED
    // If we have free text (code_text or value_string), use code.text format
    // If we have a SNOMED code, use code.coding format
    const hasCodeText = info.code_text && info.code_text.trim().length > 0;
    const hasValueString = info.value_string && info.value_string.trim && info.value_string.trim().length > 0;
    const hasCode = info.code && info.code.trim && info.code.trim().length > 0;
    
    if (isChiefComplaint) {
      // Chief complaint MUST have code element (BV-00531)
      // NPHIES does NOT allow valueString for chief-complaint - free text MUST go in code.text
      if (hasCode && hasCodeText) {
        // Both SNOMED code and free text provided (direct/preview flow)
        supportingInfo.code = {
          coding: [{
            system: info.code_system || 'http://snomed.info/sct',
            code: info.code,
            display: info.code_display
          }],
          text: info.code_text
        };
        info._usedValueStringForCodeText = true;
      } else if (hasCode && hasValueString) {
        // Both SNOMED code and free text (DB round-trip: code_text was saved as value_string)
        supportingInfo.code = {
          coding: [{
            system: info.code_system || 'http://snomed.info/sct',
            code: info.code,
            display: info.code_display
          }],
          text: info.value_string
        };
        info._usedValueStringForCodeText = true;
      } else if (hasCodeText || (hasValueString && !hasCode)) {
        // Free text only - use code.text format
        supportingInfo.code = {
          text: info.code_text || info.value_string
        };
        info._usedValueStringForCodeText = true;
      } else if (hasCode) {
        // SNOMED code only - use code.coding format
        supportingInfo.code = {
          coding: [{
            system: info.code_system || 'http://snomed.info/sct',
            code: info.code,
            display: info.code_display
          }]
        };
      } else {
        // BV-00531 requires a code; never invent a complaint
        throw mappingError('chief-complaint supporting info requires a code or free text (code, code_text or value_string)');
      }
    } else if (info.code) {
      const codeableConcept = {
        coding: [
          {
            system: info.code_system || this.getSupportingInfoCodeSystem(info.category),
            code: info.code,
            display: info.code_display
          }
        ]
      };
      
      // NPHIES requires investigation-result to use 'code' field, NOT 'valueCodeableConcept'
      // DT-01293 error occurs if valueCodeableConcept is used
      supportingInfo.code = codeableConcept;
    }

    // Add timing
    if (info.timing_period_start || info.timing_start) {
      supportingInfo.timingPeriod = {
        start: this.formatDateTime(info.timing_period_start || info.timing_start),
        end: this.formatDateTime(info.timing_period_end || info.timing_end || info.timing_period_start || info.timing_start)
      };
    } else if (info.timing_date) {
      supportingInfo.timingDate = this.formatDate(info.timing_date);
    }

    // Add value based on type
    // GE-00013: Onset category should NOT have any value fields (only code and timingDate per NPHIES spec)
    // Skip value fields for onset category
    const isOnset = category === 'onset' || info._isOnset;
    
    if (!isOnset) {
      // Skip valueString if we already used it for code.text (chief-complaint case)
      if (info.value_string !== undefined && info.value_string !== null && !info._usedValueStringForCodeText) {
        supportingInfo.valueString = info.value_string;
      } else if (info.value_quantity !== null && info.value_quantity !== undefined) {
        const ucumCode = this.getUCUMCode(info.value_quantity_unit || info.unit);
        supportingInfo.valueQuantity = {
          value: parseFloat(info.value_quantity),
          system: 'http://unitsofmeasure.org',
          code: ucumCode,
          unit: info.value_quantity_unit || info.unit || ucumCode
        };
      } else if (info.value_boolean !== null && info.value_boolean !== undefined) {
        supportingInfo.valueBoolean = info.value_boolean;
      } else if (info.value_date) {
        supportingInfo.valueDate = this.formatDate(info.value_date);
      } else if (info.value_period_start) {
        supportingInfo.valuePeriod = {
          start: this.formatDateTime(info.value_period_start),
          end: this.formatDateTime(info.value_period_end)
        };
      } else if (info.value_reference) {
        supportingInfo.valueReference = {
          reference: info.value_reference
        };
      } else if (info.value_attachment) {
        // Handle valueAttachment for attachment category
        supportingInfo.valueAttachment = {
          contentType: info.value_attachment.contentType,
          data: info.value_attachment.data
        };
        // Add optional fields if present
        if (info.value_attachment.title) {
          supportingInfo.valueAttachment.title = info.value_attachment.title;
        }
        if (info.value_attachment.creation) {
          supportingInfo.valueAttachment.creation = info.value_attachment.creation;
        }
      }
    }

    // Add reason
    if (info.reason_code) {
      supportingInfo.reason = {
        coding: [
          {
            system: info.reason_system || 'http://nphies.sa/terminology/CodeSystem/supporting-info-reason',
            code: info.reason_code
          }
        ]
      };
    }

    return supportingInfo;
  }

  // ============================================
  // CLAIM RELATED BUILDER - For resubmission and update scenarios
  // ============================================

  /**
   * Build Claim.related structure for resubmission or update scenarios
   * 
   * Resubmission (is_resubmission): When a prior authorization is rejected or partially approved,
   * a new request can be submitted referencing the original authorization.
   * Reference: NPHIES Test Case 6 - Rejected Authorization Resubmission
   * 
   * IMPORTANT: For resubmission, the related claim MUST refer to an existing claim in NPHIES.
   * Therefore, we must use the NPHIES identifier system and the original authorization's
   * NPHIES-assigned identifier (pre_auth_ref), not the provider's request_number.
   * 
   * Update (is_update): For modifications to an existing authorization using pre_auth_ref.
   * 
   * @param {Object} priorAuth - Prior authorization data
   * @param {string} providerIdentifierSystem - Provider's identifier system URL
   * @returns {Array|null} Array with related claim structure, or null if not applicable
   */
  buildClaimRelated(priorAuth, providerIdentifierSystem) {
    // Resubmission: rejected/partial authorization being resubmitted
    // MUST reference the original Claim using its original identifier (provider system + request_number)
    // Error BV-00725: "related claim SHALL refer to an existing claim in nphies"
    // The referenced claim must use the same identifier that was used in the original Claim.identifier
    if (priorAuth.is_resubmission) {
      // Use the original authorization's request_number with the provider's identifier system
      // This matches the original Claim.identifier that was sent to NPHIES
      const originalRequestNumber = priorAuth.related_claim_identifier;
      
      if (originalRequestNumber) {
        return [{
          claim: {
            identifier: {
              system: `${providerIdentifierSystem}/authorization`,
              value: originalRequestNumber
            }
          },
          relationship: {
            coding: [{
              system: 'http://nphies.sa/terminology/CodeSystem/related-claim-relationship',
              code: 'prior'
            }]
          }
        }];
      }
    }
    
    // Follow-up/Update: adding services to an approved authorization (Use Case 7)
    // MUST reference the original Claim using its original identifier (provider system + request_number)
    // Error BV-00725: "related claim SHALL refer to an existing claim in nphies"
    // The referenced claim must use the same identifier that was used in the original Claim.identifier
    if (priorAuth.is_update) {
      // Use the original authorization's request_number with the provider's identifier system
      // This matches the original Claim.identifier that was sent to NPHIES
      // Priority: Use related_claim_identifier if set, otherwise try to get from related_auth_id context
      const originalRequestNumber = priorAuth.related_claim_identifier || 
                                    priorAuth.related_auth_request_number;
      
      if (originalRequestNumber) {
        return [{
          claim: {
            identifier: {
              system: `${providerIdentifierSystem}/authorization`,
              value: originalRequestNumber
            }
          },
          relationship: {
            coding: [{
              system: 'http://nphies.sa/terminology/CodeSystem/related-claim-relationship',
              code: 'prior'
            }]
          }
        }];
      }
    }
    
    return null;
  }

  // ============================================
  // CLAIM ITEM BUILDER - Base implementation
  // ============================================

  /**
   * Build a base claim item - override in child classes for specific handling
   */
  /**
   * Item servicedDate (YYYY-MM-DD, Saudi calendar), kept within the encounter period (BV-00041).
   * Comparison is by Saudi calendar date, so the result does not depend on the host timezone
   * or on the time of day the bundle is built.
   */
  resolveServicedDate(servicedDate, encounterPeriod) {
    let date = formatSaudiDate(servicedDate || encounterPeriod?.start || new Date());
    const start = formatSaudiDate(encounterPeriod?.start);
    const end = formatSaudiDate(encounterPeriod?.end);
    if (start && date < start) date = start;
    if (end && date > end) date = end;
    return date;
  }

  /** Parsed payer share, or null when not provided (null, '', undefined or not a number). */
  parsePayerShare(value) {
    if (value === null || value === undefined || value === '') return null;
    const parsed = parseFloat(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  buildClaimItem(item, authType, itemIndex, supportingInfoSequences = [], encounterPeriod = null, sequenceMap = null) {
    const sequence = item.sequence || itemIndex;
    
    const quantity = parseFloat(item.quantity || 1);
    const unitPrice = parseFloat(item.unit_price || 0);
    const factor = parseFloat(item.factor ?? 1);
    const tax = parseFloat(item.tax || 0);
    
    const calculatedNet = (quantity * unitPrice * factor) + tax;
    
    // Build item-level extensions
    const itemExtensions = [];

    itemExtensions.push({
      url: 'http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-package',
      valueBoolean: item.is_package || false
    });

    const patientShare = parseFloat(item.patient_share || 0);
    itemExtensions.push({
      url: 'http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-patient-share',
      valueMoney: {
        value: patientShare,
        currency: item.currency || 'SAR'
      }
    });

    // Only a real payer share; null/empty from the database would otherwise serialize as NaN/null
    const payerShare = this.parsePayerShare(item.payer_share);
    if (payerShare !== null) {
      itemExtensions.push({
        url: 'http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-payer-share',
        valueMoney: {
          value: payerShare,
          currency: item.currency || 'SAR'
        }
      });
    }

    itemExtensions.push({
      url: 'http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-maternity',
      valueBoolean: item.is_maternity || false
    });

    itemExtensions.push({
      url: 'http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-tax',
      valueMoney: {
        value: tax,
        currency: item.currency || 'SAR'
      }
    });

    const claimItem = {
      factor,
      extension: itemExtensions,
      sequence: sequence,
      careTeamSequence: [1],
      diagnosisSequence: item.diagnosis_sequences || [1],
      informationSequence: this.resolveInformationSequences(item, supportingInfoSequences, sequenceMap),
      productOrService: {
        coding: (() => {
          const codings = [{
            system: item.product_or_service_system || 'http://nphies.sa/terminology/CodeSystem/procedures',
            code: item.product_or_service_code,
            display: item.product_or_service_display
          }];
          if (item.shadow_code && item.shadow_code_system) {
            const sc = { system: item.shadow_code_system, code: item.shadow_code };
            if (item.shadow_code_display) sc.display = item.shadow_code_display;
            codings.push(sc);
          }
          return codings;
        })()
      }
    };

    claimItem.servicedDate = this.resolveServicedDate(item.serviced_date, encounterPeriod);

    claimItem.quantity = { value: quantity };

    claimItem.unitPrice = {
      value: unitPrice,
      currency: item.currency || 'SAR'
    };


    claimItem.net = {
      value: calculatedNet,
      currency: item.currency || 'SAR'
    };

    // Add detail array for package items (BV-00036: required when package=true)
    if (item.is_package === true && item.details && Array.isArray(item.details) && item.details.length > 0) {
      claimItem.detail = item.details.map((detail, idx) => {
        const detailQuantity = parseFloat(detail.quantity || 1);
        const detailUnitPrice = parseFloat(detail.unit_price || 0);
        const detailFactor = parseFloat(detail.factor ?? 1);
        // BV-00434: detail net must equal ((quantity * unit price) * factor) + tax
        // For now, detail items don't have tax field, so use 0 (or could proportionally allocate parent item tax)
        const detailTax = parseFloat(detail.tax || 0);
        const detailNet = (detailQuantity * detailUnitPrice * detailFactor) + detailTax;

        return {
          sequence: detail.sequence || (idx + 1),
          productOrService: {
            coding: (() => {
              const codings = [{
                system: detail.product_or_service_system || item.product_or_service_system || 'http://nphies.sa/terminology/CodeSystem/procedures',
                code: detail.product_or_service_code,
                display: detail.product_or_service_display
              }];
              if (detail.shadow_code && detail.shadow_code_system) {
                const sc = { system: detail.shadow_code_system, code: detail.shadow_code };
                if (detail.shadow_code_display) sc.display = detail.shadow_code_display;
                codings.push(sc);
              }
              return codings;
            })()
          },
          quantity: { value: detailQuantity },
          unitPrice: { 
            value: detailUnitPrice, 
            currency: detail.currency || item.currency || 'SAR' 
          },
          factor: detailFactor,
          net: { 
            value: detailNet, 
            currency: detail.currency || item.currency || 'SAR' 
          }
        };
      });
    }

    return claimItem;
  }

  // ============================================
  // RESPONSE PARSING
  // ============================================

  /**
   * Parse Prior Authorization Response Bundle
   */
  parsePriorAuthResponse(responseBundle) {
    if (responseBundle?.resourceType === 'OperationOutcome') {
      return { success: false, outcome: 'error', errors: operationOutcomeErrors(responseBundle), rawBundle: responseBundle };
    }
    try {
      if (!responseBundle || !responseBundle.entry) {
        throw new Error('Invalid response bundle');
      }

      const messageHeader = responseBundle.entry.find(e => e.resource?.resourceType === 'MessageHeader')?.resource;
      const claimResponse = responseBundle.entry.find(e => e.resource?.resourceType === 'ClaimResponse')?.resource;
      const operationOutcome = responseBundle.entry.find(e => e.resource?.resourceType === 'OperationOutcome')?.resource;
      const patientResource = responseBundle.entry.find(e => e.resource?.resourceType === 'Patient')?.resource;
      const coverageResource = responseBundle.entry.find(e => e.resource?.resourceType === 'Coverage')?.resource;
      const providerResource = responseBundle.entry.find(
        e => e.resource?.resourceType === 'Organization' && 
             e.resource?.identifier?.some(i => i.system?.includes('provider-license'))
      )?.resource;
      const insurerResource = responseBundle.entry.find(
        e => e.resource?.resourceType === 'Organization' && 
             e.resource?.identifier?.some(i => i.system?.includes('payer-license'))
      )?.resource;

      const isNphiesGenerated = responseBundle.meta?.tag?.some(
        tag => tag.system === 'http://nphies.sa/terminology/CodeSystem/meta-tag' && 
               tag.code === 'nphies-generated'
      );


      // Handle OperationOutcome errors
      if (operationOutcome) {
        const errors = operationOutcomeErrors(operationOutcome);

        if (errors.some(e => e.severity === 'error' || e.severity === 'fatal')) {
          return {
            success: false,
            outcome: 'error',
            isNphiesGenerated,
            errors
          };
        }
      }

      if (!claimResponse) {
        console.log('[BaseMapper] ERROR: No ClaimResponse in bundle');
        return {
          success: false,
          outcome: 'error',
          isNphiesGenerated,
          errors: [{ code: 'PARSE_ERROR', message: 'No ClaimResponse found in bundle' }]
        };
      }

      // Ids and codes only; full ClaimResponse content (extensions, patient data) only in debug mode
      if (debugBundlesEnabled()) {
        console.log('[BaseMapper] ClaimResponse:', JSON.stringify(claimResponse));
      }

      // Find the adjudication outcome extension
      const adjudicationExt = claimResponse.extension?.find(
        ext => ext.url?.includes('extension-adjudication-outcome')
      );
      const adjudicationOutcome = adjudicationExt?.valueCodeableConcept?.coding?.[0]?.code;
      console.log('[BaseMapper] Parsed ClaimResponse:', JSON.stringify({
        id: claimResponse.id, outcome: claimResponse.outcome, adjudicationOutcome,
        errorCount: claimResponse.error?.length || 0
      }));

      const preAuthRef = claimResponse.preAuthRef;
      const preAuthPeriod = claimResponse.preAuthPeriod;

      const itemResults = claimResponse.item?.map(item => {
        const itemOutcome = item.extension?.find(
          ext => ext.url?.includes('extension-adjudication-outcome')
        )?.valueCodeableConcept?.coding?.[0]?.code;

        // Parse all adjudication details
        const adjudicationList = item.adjudication?.map(adj => ({
          category: adj.category?.coding?.[0]?.code,
          categoryDisplay: adj.category?.coding?.[0]?.display,
          amount: adj.amount?.value,
          value: adj.value,
          currency: adj.amount?.currency,
          reason: adj.reason?.coding?.[0]?.code,
          reasonDisplay: adj.reason?.coding?.[0]?.display
        }));

        // Extract specific adjudication amounts for easy access
        const eligibleAmount = adjudicationList?.find(a => a.category === 'eligible')?.amount;
        const benefitAmount = adjudicationList?.find(a => a.category === 'benefit')?.amount;
        const copayAmount = adjudicationList?.find(a => a.category === 'copay')?.amount;
        const approvedQuantity = adjudicationList?.find(a => a.category === 'approved-quantity')?.value;

        return {
          itemSequence: item.itemSequence,
          outcome: itemOutcome,
          adjudication: adjudicationList,
          // Pre-extracted amounts for easier access
          eligibleAmount,
          benefitAmount,
          copayAmount,
          approvedQuantity
        };
      });

      const totals = claimResponse.total?.map(total => ({
        category: total.category?.coding?.[0]?.code,
        categoryDisplay: total.category?.coding?.[0]?.display,
        amount: total.amount?.value,
        currency: total.amount?.currency
      }));

      const transferAuthNumber = claimResponse.extension?.find(
        ext => ext.url?.includes('extension-transferAuthorizationNumber')
      )?.valueString;

      const transferAuthProvider = claimResponse.extension?.find(
        ext => ext.url?.includes('extension-transferAuthorizationProvider')
      )?.valueReference?.identifier?.value;

      const transferAuthPeriod = claimResponse.extension?.find(
        ext => ext.url?.includes('extension-transferAuthorizationPeriod')
      )?.valuePeriod;

      // Extract errors from ClaimResponse.error field (NPHIES specific)
      const parsedClaimErrors = claimResponseErrors(claimResponse);

      const outcome = claimResponse.outcome || 'complete';
      const hasErrors = parsedClaimErrors.length > 0 || outcome === 'error';
      const success = (outcome === 'complete' || outcome === 'partial') && 
                      (adjudicationOutcome !== 'rejected') && !hasErrors;

      const patient = patientResource ? {
        id: patientResource.id,
        name: patientResource.name?.[0]?.text || 
              [patientResource.name?.[0]?.given?.join(' '), patientResource.name?.[0]?.family].filter(Boolean).join(' '),
        identifier: patientResource.identifier?.[0]?.value,
        identifierType: patientResource.identifier?.[0]?.type?.coding?.[0]?.code,
        gender: patientResource.gender,
        birthDate: patientResource.birthDate
      } : null;

      const coverage = coverageResource ? {
        id: coverageResource.id,
        memberId: coverageResource.identifier?.[0]?.value,
        status: coverageResource.status,
        type: coverageResource.type?.coding?.[0]?.display,
        typeCode: coverageResource.type?.coding?.[0]?.code,
        relationship: coverageResource.relationship?.coding?.[0]?.code,
        periodStart: coverageResource.period?.start,
        periodEnd: coverageResource.period?.end,
        planName: coverageResource.class?.find(c => c.type?.coding?.[0]?.code === 'plan')?.name,
        planValue: coverageResource.class?.find(c => c.type?.coding?.[0]?.code === 'plan')?.value
      } : null;

      const provider = providerResource ? {
        id: providerResource.id,
        name: providerResource.name,
        nphiesId: providerResource.identifier?.find(i => i.system?.includes('provider-license'))?.value
      } : null;

      const insurerData = insurerResource ? {
        id: insurerResource.id,
        name: insurerResource.name,
        nphiesId: insurerResource.identifier?.find(i => i.system?.includes('payer-license'))?.value
      } : null;

      // Extract insurance details from ClaimResponse
      const insuranceDetails = claimResponse.insurance?.[0];
      
      // Extract original request identifier
      const originalRequestIdentifier = claimResponse.request?.identifier?.value;

      return {
        success,
        outcome,
        adjudicationOutcome,
        disposition: claimResponse.disposition,
        preAuthRef,
        preAuthPeriod: preAuthPeriod ? {
          start: preAuthPeriod.start,
          end: preAuthPeriod.end
        } : null,
        nphiesResponseId: claimResponse.identifier?.[0]?.value || claimResponse.id,
        responseCode: messageHeader?.response?.code,
        isNphiesGenerated,
        // ClaimResponse metadata
        claimResponseStatus: claimResponse.status,
        claimResponseUse: claimResponse.use,
        claimResponseCreated: claimResponse.created,
        // Legacy fields (keeping for backward compatibility)
        status: claimResponse.status,
        type: claimResponse.type?.coding?.[0]?.code,
        subType: claimResponse.subType?.coding?.[0]?.code,
        use: claimResponse.use,
        created: claimResponse.created,
        // MessageHeader details
        messageHeaderId: messageHeader?.id,
        // Insurance details
        insuranceSequence: insuranceDetails?.sequence,
        insuranceFocal: insuranceDetails?.focal,
        // Original request reference
        originalRequestIdentifier,
        // Results
        itemResults,
        totals,
        patient,
        coverage,
        provider,
        insurer: insurerData,
        transfer: transferAuthNumber ? {
          authNumber: transferAuthNumber,
          provider: transferAuthProvider,
          period: transferAuthPeriod ? {
            start: transferAuthPeriod.start,
            end: transferAuthPeriod.end
          } : null
        } : null,
        errors: parsedClaimErrors.length > 0 ? parsedClaimErrors : undefined,
        rawBundle: responseBundle
      };

    } catch (error) {
      console.error('Error parsing prior auth response:', error);
      return {
        success: false,
        outcome: 'error',
        errors: [{
          code: 'PARSE_ERROR',
          message: error.message
        }]
      };
    }
  }

  /**
   * Validate Prior Authorization response bundle structure
   */
  validatePriorAuthResponse(response) {
    const errors = [];

    if (!response) {
      errors.push('Response is empty');
      return { valid: false, errors };
    }

    if (response.resourceType !== 'Bundle') {
      errors.push('Response is not a FHIR Bundle');
      return { valid: false, errors };
    }

    if (response.type !== 'message') {
      errors.push('Bundle type is not "message"');
    }

    if (!response.entry || !Array.isArray(response.entry)) {
      errors.push('Bundle has no entries');
      return { valid: false, errors };
    }

    const firstEntry = response.entry[0];
    if (!firstEntry || firstEntry.resource?.resourceType !== 'MessageHeader') {
      errors.push('First entry must be MessageHeader');
    }

    const eventCode = firstEntry?.resource?.eventCoding?.code;
    if (eventCode !== 'priorauth-response') {
      errors.push(`Expected priorauth-response event, got: ${eventCode}`);
    }

    const hasClaimResponse = response.entry.some(
      e => e.resource?.resourceType === 'ClaimResponse'
    );
    const hasOperationOutcome = response.entry.some(
      e => e.resource?.resourceType === 'OperationOutcome'
    );

    if (!hasClaimResponse && !hasOperationOutcome) {
      errors.push('Bundle must contain ClaimResponse or OperationOutcome');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  // ============================================
  // ABSTRACT METHODS - Must be implemented by child classes
  // ============================================

  /**
   * Build the complete Prior Authorization Request Bundle
   * This method MUST be implemented by each specialized mapper
   */
  buildPriorAuthRequestBundle(data) {
    throw new Error('buildPriorAuthRequestBundle must be implemented by child class');
  }

  /**
   * Build Claim resource - can be overridden for type-specific claim building
   */
  buildClaimResource(priorAuth, patient, provider, insurer, coverage, encounter, practitioner, bundleResourceIds) {
    throw new Error('buildClaimResource must be implemented by child class');
  }

  /**
   * Build Encounter resource - can be overridden for type-specific encounter building
   */
  buildEncounterResourceWithId(priorAuth, patient, provider, bundleResourceIds) {
    throw new Error('buildEncounterResourceWithId must be implemented by child class');
  }

  // ============================================
  // CANCEL REQUEST METHODS
  // ============================================

  /**
   * Map cancel reason text to NPHIES Task Reason Code
   * Reference: https://portal.nphies.sa/ig/ValueSet-task-reason-code.html
   * 
   * Valid codes:
   * - WI: wrong information - Wrong information have been submitted
   * - NP: service not performed - Service was not performed
   * - TAS: transaction already submitted - Transaction already submitted
   * - SU: Product/Service is unavailable
   * - resubmission: Claim Re-submission
   * 
   * @param {string} reason - The reason text or code
   * @returns {Object} { code, display }
   */
  mapCancelReasonToCode(reason) {
    const reasonLower = (reason || '').toLowerCase().trim();
    
    // Direct code mapping
    const codeMap = {
      'wi': { code: 'WI', display: 'wrong information' },
      'np': { code: 'NP', display: 'service not performed' },
      'tas': { code: 'TAS', display: 'transaction already submitted' },
      'su': { code: 'SU', display: 'Product/Service is unavailable' },
      'resubmission': { code: 'resubmission', display: 'Claim Re-submission.' }
    };

    // Check if reason is already a valid code
    if (codeMap[reasonLower]) {
      return codeMap[reasonLower];
    }

    // Try to match by keywords in the reason text
    if (reasonLower.includes('wrong') || reasonLower.includes('incorrect') || reasonLower.includes('error')) {
      return codeMap['wi'];
    }
    if (reasonLower.includes('not performed') || reasonLower.includes('not done') || reasonLower.includes('cancelled')) {
      return codeMap['np'];
    }
    if (reasonLower.includes('already') || reasonLower.includes('duplicate') || reasonLower.includes('submitted')) {
      return codeMap['tas'];
    }
    if (reasonLower.includes('unavailable') || reasonLower.includes('not available')) {
      return codeMap['su'];
    }
    if (reasonLower.includes('resubmit') || reasonLower.includes('re-submit')) {
      return codeMap['resubmission'];
    }

    // Default to "service not performed" for general cancellations
    return codeMap['np'];
  }

  /**
   * Build Task resource for Cancel Request
   * Reference: https://portal.nphies.sa/ig/usecase-cancel.html
   * Example: https://portal.nphies.sa/ig/Bundle-c2c63768-a65b-4784-ab91-6c09012c3aca.json.html
   * 
   * Key requirements:
   * - Task.identifier: unique identifier for the cancel task
   * - Task.intent: MUST be 'order' (not 'proposal')
   * - Task.priority: 'routine'
   * - Task.focus.identifier: the original request identifier to cancel
   * - Task.requester: reference to Provider Organization
   * - Task.owner: reference to Insurer Organization
   * - Task.lastModified: date of the request
   */
  buildCancelTask(priorAuth, provider, insurer, reason, bundleResourceIds) {
    const taskId = bundleResourceIds.task;
    const providerId = bundleResourceIds.provider;
    const insurerId = bundleResourceIds.insurer;
    
    // Same derivation as the submitted Claim.identifier (".com.sa/identifiers/<authorization|claim>")
    const providerIdentifierSystem = this.getProviderIdentifierSystem(provider);
    // The record may carry the exact system of the submitted Claim.identifier (e.g. read back
    // from ClaimResponse.request.identifier); otherwise derive it the same way the Claim did.
    const focusIdentifierSystem = priorAuth.focus_identifier_system || this.getClaimIdentifierSystem(provider);
    
    // Unique per attempt: re-trying a cancel must not reuse the previous Task identifier
    const cancelTaskIdentifier = `Cancel_${priorAuth.request_number || priorAuth.id || 'request'}_${taskId}`;
    
    // Get current date in YYYY-MM-DD format for authoredOn and lastModified
    const currentDate = this.formatDate(new Date());

    const task = {
      resourceType: 'Task',
      id: taskId,
      meta: {
        profile: ['http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/task|1.0.0']
      },
      // Task identifier - required per NPHIES standard
      identifier: [
        {
          system: `${providerIdentifierSystem}/task`,
          value: cancelTaskIdentifier
        }
      ],
      status: 'requested',
      // MUST be 'order' per NPHIES standard (not 'proposal')
      intent: 'order',
      // Priority is required
      priority: 'routine',
      code: {
        coding: [
          {
            system: 'http://nphies.sa/terminology/CodeSystem/task-code',
            code: 'cancel'
          }
        ]
      },
      // Focus: the original request to be cancelled
      // Uses the original request identifier (request_number), not pre_auth_ref
      // IC-01428: Must include 'type' element to indicate what resource is being cancelled
      focus: {
        type: 'Claim',
        identifier: {
          system: focusIdentifierSystem,
          value: priorAuth.request_number || priorAuth.nphies_request_id || priorAuth.pre_auth_ref
        }
      },
      // Date only format per NPHIES example
      authoredOn: currentDate,
      // lastModified is required per NPHIES standard
      lastModified: currentDate,
      // Requester: reference to Provider Organization in the bundle
      requester: {
        reference: `Organization/${providerId}`
      },
      // Owner: reference to Insurer Organization in the bundle
      owner: {
        reference: `Organization/${insurerId}`
      }
    };

    // Add reason using Task.reasonCode (NOT statusReason)
    // IB-00229: statusReason uses task-status-reason ValueSet which is for RESPONSE only
    // For cancel REQUEST, we use reasonCode with task-reason-code ValueSet
    // Reference: https://portal.nphies.sa/ig/ValueSet-task-reason-code.html
    // Valid codes: WI (wrong information), NP (service not performed), 
    //              TAS (transaction already submitted), SU (Product/Service unavailable),
    //              resubmission (Claim Re-submission)
    const reasonCode = this.mapCancelReasonToCode(reason);
    task.reasonCode = {
      coding: [
        {
          system: 'http://nphies.sa/terminology/CodeSystem/task-reason-code',
          code: reasonCode.code,
          display: reasonCode.display
        }
      ]
    };

    return task;
  }

  /**
   * Build Cancel Request Bundle
   * Reference: https://portal.nphies.sa/ig/usecase-cancel.html
   * 
   * Bundle structure per NPHIES standard:
   * 1. MessageHeader (eventCoding = cancel-request)
   * 2. Task (code = cancel)
   * 3. Organization (Insurer)
   * 4. Organization (Provider)
   */
  buildCancelRequestBundle(priorAuth, provider, insurer, reason) {
    // Generate consistent IDs for bundle resources
    const bundleResourceIds = {
      task: this.generateId(),
      provider: provider.provider_id || this.generateId(),
      insurer: insurer.insurer_id || this.generateId()
    };

    // Build Provider Organization resource
    const providerResource = this.buildProviderOrganizationWithId(provider, bundleResourceIds.provider);
    
    // Build Insurer Organization resource
    const insurerResource = this.buildInsurerOrganizationWithId(insurer, bundleResourceIds.insurer);
    
    // Build Task resource with references to organizations
    const task = this.buildCancelTask(priorAuth, provider, insurer, reason, bundleResourceIds);
    const taskEntry = {
      fullUrl: `http://provider.com/Task/${task.id}`,
      resource: task
    };

    // Build MessageHeader
    const messageHeaderId = this.generateId();
    const messageHeader = {
      fullUrl: `urn:uuid:${messageHeaderId}`,
      resource: {
        resourceType: 'MessageHeader',
        id: messageHeaderId,
        meta: {
          profile: ['http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/message-header|1.0.0']
        },
        eventCoding: {
          system: 'http://nphies.sa/terminology/CodeSystem/ksa-message-events',
          code: 'cancel-request'
        },
        destination: [
          {
            endpoint: `http://nphies.sa/license/payer-license/${requireInsurerLicense(insurer)}`,
            receiver: {
              type: 'Organization',
              identifier: {
                system: 'http://nphies.sa/license/payer-license',
                value: requireInsurerLicense(insurer)
              }
            }
          }
        ],
        sender: {
          type: 'Organization',
          identifier: {
            system: 'http://nphies.sa/license/provider-license',
            value: requireProviderLicense(provider)
          }
        },
        // Same source endpoint as every other provider message
        source: {
          endpoint: 'http://provider.com'
        },
        focus: [
          {
            reference: taskEntry.fullUrl
          }
        ]
      }
    };

    // Build bundle with all required resources per NPHIES standard:
    // MessageHeader, Task, Insurer Organization, Provider Organization
    return {
      resourceType: 'Bundle',
      id: this.generateId(),
      meta: {
        profile: ['http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/bundle|1.0.0']
      },
      type: 'message',
      timestamp: this.formatDateTime(new Date()),
      entry: [
        messageHeader,
        taskEntry,
        insurerResource,
        providerResource
      ]
    };
  }
}

export default BaseMapper;

