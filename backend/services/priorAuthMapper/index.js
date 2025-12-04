/**
 * NPHIES Prior Authorization Mapper Factory
 * 
 * This module provides a factory pattern for selecting the appropriate
 * mapper based on authorization type while maintaining backward compatibility
 * with existing code that imports from the old monolithic mapper.
 * 
 * Usage:
 *   // New recommended usage
 *   import { getMapper } from './services/priorAuthMapper/index.js';
 *   const mapper = getMapper('dental');
 *   const bundle = mapper.buildPriorAuthRequestBundle(data);
 * 
 *   // Backward compatible usage (auto-detects auth type)
 *   import priorAuthMapper from './services/priorAuthMapper/index.js';
 *   const bundle = priorAuthMapper.buildPriorAuthRequestBundle(data);
 */

import BaseMapper from './BaseMapper.js';
import ProfessionalMapper from './ProfessionalMapper.js';
import InstitutionalMapper from './InstitutionalMapper.js';
import DentalMapper from './DentalMapper.js';
import VisionMapper from './VisionMapper.js';
import PharmacyMapper from './PharmacyMapper.js';

// Singleton instances for each mapper type
const mapperInstances = {
  professional: null,
  institutional: null,
  dental: null,
  vision: null,
  pharmacy: null
};

/**
 * Get the appropriate mapper instance for the given auth type
 * @param {string} authType - One of: professional, institutional, dental, vision, pharmacy
 * @returns {BaseMapper} The appropriate mapper instance
 */
export function getMapper(authType) {
  const normalizedType = (authType || 'professional').toLowerCase();
  
  // Map alternative names
  const typeMapping = {
    'professional': 'professional',
    'institutional': 'institutional',
    'inpatient': 'institutional',
    'daycase': 'institutional',
    'dental': 'dental',
    'oral': 'dental',
    'vision': 'vision',
    'ophthalmic': 'vision',
    'pharmacy': 'pharmacy',
    'medication': 'pharmacy',
    'rx': 'pharmacy'
  };
  
  const mappedType = typeMapping[normalizedType] || 'professional';
  
  // Create singleton instance if not exists
  if (!mapperInstances[mappedType]) {
    switch (mappedType) {
      case 'professional':
        mapperInstances.professional = new ProfessionalMapper();
        break;
      case 'institutional':
        mapperInstances.institutional = new InstitutionalMapper();
        break;
      case 'dental':
        mapperInstances.dental = new DentalMapper();
        break;
      case 'vision':
        mapperInstances.vision = new VisionMapper();
        break;
      case 'pharmacy':
        mapperInstances.pharmacy = new PharmacyMapper();
        break;
      default:
        mapperInstances.professional = new ProfessionalMapper();
        return mapperInstances.professional;
    }
  }
  
  return mapperInstances[mappedType];
}

/**
 * Detect auth type from data object
 * @param {Object} data - Prior authorization data
 * @returns {string} Detected auth type
 */
function detectAuthType(data) {
  // Check priorAuth.auth_type first
  if (data?.priorAuth?.auth_type) {
    return data.priorAuth.auth_type;
  }
  
  // Check root level auth_type
  if (data?.auth_type) {
    return data.auth_type;
  }
  
  // Infer from encounter class for institutional
  const encounterClass = data?.priorAuth?.encounter_class || data?.encounter_class;
  if (['inpatient', 'daycase'].includes(encounterClass)) {
    return 'institutional';
  }
  
  // Check for vision prescription data
  if (data?.visionPrescription || data?.priorAuth?.vision_prescription) {
    return 'vision';
  }
  
  // Check for dental indicators
  if (data?.priorAuth?.service_event_type || 
      data?.priorAuth?.items?.some(item => item.tooth_number)) {
    return 'dental';
  }
  
  // Check for pharmacy indicators
  if (data?.priorAuth?.days_supply ||
      data?.priorAuth?.items?.some(item => item.medication_code)) {
    return 'pharmacy';
  }
  
  // Default to professional
  return 'professional';
}

/**
 * Backward-compatible wrapper that auto-detects auth type
 * Maintains the same interface as the old monolithic mapper
 */
class PriorAuthMapperProxy {
  /**
   * Build Prior Authorization Request Bundle
   * Auto-detects the auth type and delegates to the appropriate mapper
   */
  buildPriorAuthRequestBundle(data) {
    const authType = detectAuthType(data);
    const mapper = getMapper(authType);
    return mapper.buildPriorAuthRequestBundle(data);
  }

  /**
   * Parse Prior Authorization Response Bundle
   * Uses BaseMapper since response parsing is the same for all types
   */
  parsePriorAuthResponse(responseBundle) {
    return getMapper('professional').parsePriorAuthResponse(responseBundle);
  }

  /**
   * Validate Prior Authorization Response
   */
  validatePriorAuthResponse(response) {
    return getMapper('professional').validatePriorAuthResponse(response);
  }

  /**
   * Build Cancel Request Bundle
   */
  buildCancelRequestBundle(priorAuth, provider, insurer, reason) {
    return getMapper('professional').buildCancelRequestBundle(priorAuth, provider, insurer, reason);
  }

  /**
   * Build Patient resource with ID
   */
  buildPatientResourceWithId(patient, patientId) {
    return getMapper('professional').buildPatientResourceWithId(patient, patientId);
  }

  /**
   * Build Provider Organization with ID
   */
  buildProviderOrganizationWithId(provider, providerId) {
    return getMapper('professional').buildProviderOrganizationWithId(provider, providerId);
  }

  /**
   * Build Insurer Organization with ID
   */
  buildInsurerOrganizationWithId(insurer, insurerId) {
    return getMapper('professional').buildInsurerOrganizationWithId(insurer, insurerId);
  }

  /**
   * Build Coverage resource with ID
   */
  buildCoverageResourceWithId(coverage, patient, insurer, policyHolder, bundleResourceIds) {
    return getMapper('professional').buildCoverageResourceWithId(coverage, patient, insurer, policyHolder, bundleResourceIds);
  }

  /**
   * Build Practitioner resource with ID
   */
  buildPractitionerResourceWithId(practitioner, practitionerId) {
    return getMapper('professional').buildPractitionerResourceWithId(practitioner, practitionerId);
  }

  /**
   * Build Encounter resource with ID
   * Delegates based on encounter class
   */
  buildEncounterResourceWithId(priorAuth, patient, provider, bundleResourceIds) {
    const authType = priorAuth?.auth_type || 'professional';
    if (authType === 'vision') {
      return null; // Vision has no encounter
    }
    const mapper = getMapper(authType);
    return mapper.buildEncounterResourceWithId(priorAuth, patient, provider, bundleResourceIds);
  }

  /**
   * Build Claim resource
   * Delegates based on auth type
   */
  buildClaimResource(priorAuth, patient, provider, insurer, coverage, encounter, practitioner, bundleResourceIds) {
    const authType = priorAuth?.auth_type || 'professional';
    const mapper = getMapper(authType);
    return mapper.buildClaimResource(priorAuth, patient, provider, insurer, coverage, encounter, practitioner, bundleResourceIds);
  }

  /**
   * Build MessageHeader
   */
  buildMessageHeader(provider, insurer, focusFullUrl) {
    return getMapper('professional').buildMessageHeader(provider, insurer, focusFullUrl);
  }

  /**
   * Build SupportingInfo
   */
  buildSupportingInfo(info) {
    return getMapper('professional').buildSupportingInfo(info);
  }

  /**
   * Build Claim Item
   */
  buildClaimItem(item, authType, itemIndex, supportingInfoSequences, encounterPeriod) {
    return getMapper(authType || 'professional').buildClaimItem(item, authType, itemIndex, supportingInfoSequences, encounterPeriod);
  }

  /**
   * Build Binary resource for attachments
   */
  buildBinaryResource(attachment) {
    return getMapper('professional').buildBinaryResource(attachment);
  }

  /**
   * Format date helpers
   */
  formatDate(date) {
    return getMapper('professional').formatDate(date);
  }

  formatDateTime(date) {
    return getMapper('professional').formatDateTime(date);
  }

  formatDateTimeWithTimezone(date) {
    return getMapper('professional').formatDateTimeWithTimezone(date);
  }

  /**
   * Code system helpers
   */
  getAuthorizationProfileUrl(authType) {
    return getMapper('professional').getAuthorizationProfileUrl(authType);
  }

  getEncounterProfileUrl(encounterClass) {
    return getMapper('professional').getEncounterProfileUrl(encounterClass);
  }

  getEncounterClassCode(encounterClass) {
    return getMapper('professional').getEncounterClassCode(encounterClass);
  }

  getEncounterClassDisplay(encounterClass) {
    return getMapper('professional').getEncounterClassDisplay(encounterClass);
  }

  getClaimTypeCode(authType) {
    return getMapper('professional').getClaimTypeCode(authType);
  }

  getClaimSubTypeCode(encounterClass, authType) {
    // Use the specific mapper for proper subType handling
    return getMapper(authType || 'professional').getClaimSubTypeCode(encounterClass, authType);
  }

  getUCUMCode(unit) {
    return getMapper('professional').getUCUMCode(unit);
  }

  getNphiesSupportingInfoCategory(category) {
    return getMapper('professional').getNphiesSupportingInfoCategory(category);
  }

  getSupportingInfoCodeSystem(category) {
    return getMapper('professional').getSupportingInfoCodeSystem(category);
  }

  /**
   * Display name helpers
   */
  getCoverageTypeDisplay(code) {
    return getMapper('professional').getCoverageTypeDisplay(code);
  }

  getRelationshipDisplay(code) {
    return getMapper('professional').getRelationshipDisplay(code);
  }

  getServiceTypeDisplay(code) {
    return getMapper('professional').getServiceTypeDisplay(code);
  }

  getBodySiteDisplay(code) {
    return getMapper('professional').getBodySiteDisplay(code);
  }

  getPracticeCodeDisplay(code) {
    return getMapper('professional').getPracticeCodeDisplay(code);
  }

  getAdmitSourceDisplay(code) {
    return getMapper('professional').getAdmitSourceDisplay(code);
  }

  getPractitionerIdentifierTypeDisplay(code) {
    return getMapper('professional').getPractitionerIdentifierTypeDisplay(code);
  }

  /**
   * Generate UUID
   */
  generateId() {
    return getMapper('professional').generateId();
  }
}

// Create singleton proxy instance for backward compatibility
const priorAuthMapperProxy = new PriorAuthMapperProxy();

// Named exports for new usage pattern
export { 
  BaseMapper,
  ProfessionalMapper,
  InstitutionalMapper,
  DentalMapper,
  VisionMapper,
  PharmacyMapper,
  detectAuthType
};

// Default export for backward compatibility
export default priorAuthMapperProxy;

