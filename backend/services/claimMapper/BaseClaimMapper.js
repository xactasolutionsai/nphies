/**
 * NPHIES Claim Base Mapper
 * Contains shared utilities and resource builders used by all claim type mappers
 * For Claims (use: "claim") - billing after services delivered
 * Reference: https://portal.nphies.sa/ig/Claim-483070.html
 */

import { randomUUID } from 'crypto';
import nphiesMapper from '../nphiesMapper.js';

class BaseClaimMapper {
  constructor() {
    this.generateId = () => randomUUID();
  }

  // ============================================
  // DATE FORMATTING UTILITIES
  // ============================================

  formatDate(date) {
    if (!date) return null;
    
    // If it's already a string in YYYY-MM-DD format or ISO format, extract date part
    if (typeof date === 'string') {
      // Handle ISO strings like "2023-12-03T21:00:00.000Z" - extract date part directly
      if (date.includes('T')) {
        return date.split('T')[0];
      }
      // Already in YYYY-MM-DD format
      if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return date;
      }
    }
    
    // For Date objects, use local date to avoid UTC conversion
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  formatDateTime(date) {
    if (!date) return new Date().toISOString();
    return new Date(date).toISOString();
  }

  formatDateTimeWithTimezone(date) {
    if (!date) date = new Date();
    const d = new Date(date);
    
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const seconds = String(d.getSeconds()).padStart(2, '0');
    
    return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}+03:00`;
  }

  // ============================================
  // PROFILE URL GETTERS
  // ============================================

  getClaimProfileUrl(claimType) {
    const profiles = {
      'institutional': 'http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/institutional-claim|1.0.0',
      'professional': 'http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/professional-claim|1.0.0',
      'pharmacy': 'http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/pharmacy-claim|1.0.0',
      'dental': 'http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/oral-claim|1.0.0',
      'vision': 'http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/vision-claim|1.0.0'
    };
    return profiles[claimType] || profiles['professional'];
  }

  getEncounterProfileUrl() {
    return 'http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/encounter|1.0.0';
  }

  getEncounterClassCode(encounterClass) {
    const codes = {
      'ambulatory': 'AMB', 'outpatient': 'AMB', 'emergency': 'EMER',
      'home': 'HH', 'inpatient': 'IMP', 'daycase': 'SS', 'telemedicine': 'VR'
    };
    return codes[encounterClass] || 'AMB';
  }

  getEncounterClassDisplay(encounterClass) {
    const displays = {
      'ambulatory': 'ambulatory', 'outpatient': 'ambulatory', 'emergency': 'emergency',
      'home': 'home health', 'inpatient': 'inpatient encounter', 'daycase': 'short stay', 'telemedicine': 'virtual'
    };
    return displays[encounterClass] || 'ambulatory';
  }

  getClaimTypeCode(claimType) {
    const types = {
      'institutional': 'institutional', 'professional': 'professional',
      'pharmacy': 'pharmacy', 'dental': 'oral', 'vision': 'vision'
    };
    return types[claimType] || 'professional';
  }

  getClaimSubTypeCode(encounterClass) {
    const subTypes = {
      'inpatient': 'ip', 'outpatient': 'op', 'daycase': 'ip',
      'emergency': 'emr', 'ambulatory': 'op', 'home': 'op', 'telemedicine': 'op'
    };
    return subTypes[encounterClass] || 'op';
  }

  getUCUMCode(unit) {
    if (!unit) return '';
    const ucumMap = {
      'mmHg': 'mm[Hg]', 'mm[Hg]': 'mm[Hg]', 'cm': 'cm', 'kg': 'kg',
      '/min': '/min', 'bpm': '/min', 'Cel': 'Cel', 'celsius': 'Cel',
      '%': '%', 'd': 'd', 'day': 'd', 'h': 'h'
    };
    return ucumMap[unit] || unit;
  }

  getNphiesSupportingInfoCategory(category) {
    const categoryMap = {
      'vital-sign-systolic': 'vital-sign-systolic', 'vital-sign-diastolic': 'vital-sign-diastolic',
      'vital-sign-height': 'vital-sign-height', 'vital-sign-weight': 'vital-sign-weight',
      'pulse': 'pulse', 'temperature': 'temperature', 'oxygen-saturation': 'oxygen-saturation',
      'respiratory-rate': 'respiratory-rate', 'admission-weight': 'admission-weight',
      'estimated-length-of-stay': 'estimated-Length-of-Stay', 'ventilation-hours': 'ventilation-hours',
      'chief-complaint': 'chief-complaint', 'patient-history': 'patient-history',
      'investigation-result': 'investigation-result', 'treatment-plan': 'treatment-plan',
      'physical-examination': 'physical-examination', 'history-of-present-illness': 'history-of-present-illness',
      'onset': 'onset', 'attachment': 'attachment', 'days-supply': 'days-supply'
    };
    return categoryMap[(category || '').toLowerCase()] || category;
  }

  getSupportingInfoCodeSystem(category) {
    const systems = {
      'chief-complaint': 'http://snomed.info/sct',
      'investigation-result': 'http://nphies.sa/terminology/CodeSystem/investigation-result',
      'onset': 'http://hl7.org/fhir/sid/icd-10-am'
    };
    return systems[category] || 'http://nphies.sa/terminology/CodeSystem/supporting-info-code';
  }

  // ============================================
  // DISPLAY HELPERS
  // ============================================

  getCoverageTypeDisplay(code) {
    const displays = { 'EHCPOL': 'Extended healthcare', 'PUBLICPOL': 'Public healthcare' };
    return displays[code] || code;
  }

  getRelationshipDisplay(code) {
    const displays = { 'self': 'Self', 'spouse': 'Spouse', 'child': 'Child', 'parent': 'Parent' };
    return displays[code] || code;
  }

  getServiceTypeDisplay(code) {
    const displays = { 'acute-care': 'Acute Care', 'sub-acute-care': 'Sub-Acute Care' };
    return displays[code] || code;
  }

  getPracticeCodeDisplay(code) {
    const displays = { '08.00': 'Internal Medicine', '08.26': 'General Medicine', '19.08': 'General Surgery' };
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

  // ============================================
  // RESOURCE BUILDERS
  // ============================================

  buildPatientResourceWithId(patient, patientId) {
    const patientResource = nphiesMapper.buildPatientResource(patient);
    patientResource.resource.id = patientId;
    patientResource.fullUrl = `http://provider.com/Patient/${patientId}`;
    return patientResource;
  }

  buildProviderOrganizationWithId(provider, providerId) {
    const providerResource = nphiesMapper.buildProviderOrganization(provider);
    providerResource.resource.id = providerId;
    providerResource.fullUrl = `http://provider.com/Organization/${providerId}`;
    if (provider.nphies_id && providerResource.resource.identifier?.[0]) {
      providerResource.resource.identifier[0].value = provider.nphies_id;
    }
    return providerResource;
  }

  buildInsurerOrganizationWithId(insurer, insurerId) {
    const insurerResource = nphiesMapper.buildPayerOrganization(insurer);
    insurerResource.resource.id = insurerId;
    insurerResource.fullUrl = `http://provider.com/Organization/${insurerId}`;
    return insurerResource;
  }

  buildCoverageResourceWithId(coverage, patient, insurer, policyHolder, bundleResourceIds) {
    const coverageId = bundleResourceIds.coverage;
    const patientId = bundleResourceIds.patient;
    const insurerId = bundleResourceIds.insurer;

    return {
      fullUrl: `http://provider.com/Coverage/${coverageId}`,
      resource: {
        resourceType: 'Coverage',
        id: coverageId,
        meta: { profile: ['http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/coverage|1.0.0'] },
        identifier: [{ system: 'http://payer.com/memberid', value: coverage?.member_id || patient.identifier || `MEM-${Date.now()}` }],
        status: 'active',
        type: {
          coding: [{
            system: 'http://nphies.sa/terminology/CodeSystem/coverage-type',
            code: coverage?.coverage_type || 'EHCPOL',
            display: this.getCoverageTypeDisplay(coverage?.coverage_type || 'EHCPOL')
          }]
        },
        policyHolder: { reference: `Patient/${policyHolder?.id || patientId}` },
        subscriber: { reference: `Patient/${patientId}` },
        beneficiary: { reference: `Patient/${patientId}` },
        relationship: {
          coding: [{
            system: 'http://terminology.hl7.org/CodeSystem/subscriber-relationship',
            code: coverage?.relationship || 'self',
            display: this.getRelationshipDisplay(coverage?.relationship || 'self')
          }]
        },
        payor: [{ reference: `Organization/${insurerId}` }],
        class: [{
          type: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/coverage-class', code: 'plan' }] },
          value: coverage?.plan_id || 'default-plan',
          name: coverage?.plan_name || 'Insurance Plan'
        }]
      }
    };
  }

  buildPractitionerResourceWithId(practitioner, practitionerId) {
    const pract = practitioner || {};
    return {
      fullUrl: `http://provider.com/Practitioner/${practitionerId}`,
      resource: {
        resourceType: 'Practitioner',
        id: practitionerId,
        meta: { profile: ['http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/practitioner|1.0.0'] },
        identifier: [{
          type: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/v2-0203', code: 'MD' }] },
          system: 'http://nphies.sa/license/practitioner-license',
          value: pract.license_number || pract.nphies_id || `PRACT-${practitionerId.substring(0, 8)}`
        }],
        active: true,
        name: [{
          use: 'official',
          text: pract.name || 'Healthcare Provider',
          family: pract.family_name || (pract.name ? pract.name.split(' ').pop() : 'Provider'),
          given: pract.given_name ? [pract.given_name] : (pract.name ? [pract.name.split(' ')[0]] : ['Healthcare'])
        }],
        qualification: [{
          code: {
            coding: [{
              system: 'http://nphies.sa/terminology/CodeSystem/practice-codes',
              code: pract.specialty_code || pract.practice_code || '08.00'
            }]
          }
        }]
      }
    };
  }

  buildMessageHeader(provider, insurer, focusFullUrl) {
    const messageHeaderId = this.generateId();
    return {
      fullUrl: `urn:uuid:${messageHeaderId}`,
      resource: {
        resourceType: 'MessageHeader',
        id: messageHeaderId,
        meta: { profile: ['http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/message-header|1.0.0'] },
        eventCoding: { system: 'http://nphies.sa/terminology/CodeSystem/ksa-message-events', code: 'claim-request' },
        destination: [{
          endpoint: `http://nphies.sa/license/payer-license/${insurer.nphies_id || 'INS-FHIR'}`,
          receiver: { type: 'Organization', identifier: { system: 'http://nphies.sa/license/payer-license', value: insurer.nphies_id || 'INS-FHIR' } }
        }],
        sender: { type: 'Organization', identifier: { system: 'http://nphies.sa/license/provider-license', value: provider.nphies_id || 'PR-FHIR' } },
        source: { endpoint: 'http://provider.com' },
        focus: [{ reference: focusFullUrl }]
      }
    };
  }

  buildBinaryResource(attachment) {
    const binaryId = attachment.binary_id || `binary-${this.generateId()}`;
    return {
      fullUrl: `http://provider.com/Binary/${binaryId}`,
      resource: { resourceType: 'Binary', id: binaryId, contentType: attachment.content_type, data: attachment.base64_content }
    };
  }

  // ============================================
  // SUPPORTING INFO BUILDER
  // ============================================

  buildSupportingInfo(info) {
    const categoryCode = this.getNphiesSupportingInfoCategory(info.category);
    const supportingInfo = {
      sequence: info.sequence,
      category: { coding: [{ system: 'http://nphies.sa/terminology/CodeSystem/claim-information-category', code: categoryCode }] }
    };

    if (info.code_text) {
      supportingInfo.code = { text: info.code_text };
    } else if (info.code) {
      supportingInfo.code = {
        coding: [{ system: info.code_system || this.getSupportingInfoCodeSystem(info.category), code: info.code, display: info.code_display }]
      };
    }

    if (info.timing_period_start) {
      supportingInfo.timingPeriod = {
        start: this.formatDateTime(info.timing_period_start),
        end: this.formatDateTime(info.timing_period_end || info.timing_period_start)
      };
    } else if (info.timing_date) {
      supportingInfo.timingDate = this.formatDate(info.timing_date);
    }

    if (info.value_string != null) supportingInfo.valueString = info.value_string;
    else if (info.value_quantity != null) {
      supportingInfo.valueQuantity = { value: parseFloat(info.value_quantity), system: 'http://unitsofmeasure.org', code: this.getUCUMCode(info.value_quantity_unit) };
    }
    else if (info.value_boolean != null) supportingInfo.valueBoolean = info.value_boolean;

    return supportingInfo;
  }

  // ============================================
  // CLAIM ITEM BUILDER
  // ============================================

  buildClaimItem(item, claimType, itemIndex, supportingInfoSequences = [], encounterPeriod = null) {
    const sequence = item.sequence || itemIndex;
    const quantity = parseFloat(item.quantity || 1);
    const unitPrice = parseFloat(item.unit_price || 0);
    const factor = parseFloat(item.factor || 1);
    const tax = parseFloat(item.tax || 0);
    const calculatedNet = (quantity * unitPrice * factor) + tax;

    const itemExtensions = [
      { url: 'http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-package', valueBoolean: item.is_package || false },
      { url: 'http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-tax', valueMoney: { value: tax, currency: item.currency || 'SAR' } },
      { url: 'http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-patient-share', valueMoney: { value: parseFloat(item.patient_share || 0), currency: item.currency || 'SAR' } },
      { url: 'http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-maternity', valueBoolean: item.is_maternity || false }
    ];

    if (item.patient_invoice) {
      itemExtensions.push({
        url: 'http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-patientInvoice',
        valueIdentifier: { system: 'http://provider.com/identifiers/patientInvoice', value: item.patient_invoice }
      });
    }

    let servicedDate = item.serviced_date ? new Date(item.serviced_date) : (encounterPeriod?.start ? new Date(encounterPeriod.start) : new Date());

    return {
      extension: itemExtensions,
      sequence,
      careTeamSequence: [1],
      diagnosisSequence: item.diagnosis_sequences || [1],
      informationSequence: item.information_sequences || supportingInfoSequences,
      productOrService: {
        coding: [{
          system: item.product_or_service_system || 'http://nphies.sa/terminology/CodeSystem/procedures',
          code: item.product_or_service_code,
          display: item.product_or_service_display
        }]
      },
      servicedDate: this.formatDate(servicedDate),
      quantity: { value: quantity },
      unitPrice: { value: unitPrice, currency: item.currency || 'SAR' },
      net: { value: calculatedNet, currency: item.currency || 'SAR' }
    };
  }

  // ============================================
  // RESPONSE PARSING
  // ============================================

  parseClaimResponse(responseBundle) {
    try {
      if (!responseBundle?.entry) throw new Error('Invalid response bundle');

      const claimResponse = responseBundle.entry.find(e => e.resource?.resourceType === 'ClaimResponse')?.resource;
      const operationOutcome = responseBundle.entry.find(e => e.resource?.resourceType === 'OperationOutcome')?.resource;

      if (operationOutcome) {
        const errors = operationOutcome.issue?.map(issue => ({
          severity: issue.severity,
          code: issue.details?.coding?.[0]?.code || issue.code,
          message: issue.details?.coding?.[0]?.display || issue.diagnostics
        })) || [];
        if (errors.some(e => e.severity === 'error' || e.severity === 'fatal')) {
          return { success: false, outcome: 'error', errors };
        }
      }

      if (!claimResponse) return { success: false, outcome: 'error', errors: [{ code: 'PARSE_ERROR', message: 'No ClaimResponse found' }] };

      const adjudicationOutcome = claimResponse.extension?.find(ext => ext.url?.includes('extension-adjudication-outcome'))?.valueCodeableConcept?.coding?.[0]?.code;
      const outcome = claimResponse.outcome || 'complete';
      const success = (outcome === 'complete' || outcome === 'partial') && adjudicationOutcome !== 'rejected';

      return {
        success, outcome, adjudicationOutcome,
        disposition: claimResponse.disposition,
        nphiesClaimId: claimResponse.identifier?.[0]?.value || claimResponse.id,
        rawBundle: responseBundle
      };
    } catch (error) {
      return { success: false, outcome: 'error', errors: [{ code: 'PARSE_ERROR', message: error.message }] };
    }
  }

  validateClaimResponse(response) {
    const errors = [];
    if (!response) errors.push('Response is empty');
    else if (response.resourceType !== 'Bundle') errors.push('Response is not a FHIR Bundle');
    else if (!response.entry?.length) errors.push('Bundle has no entries');
    return { valid: errors.length === 0, errors };
  }

  // Abstract methods
  buildClaimRequestBundle(data) { throw new Error('Must be implemented by child class'); }
  buildClaimResource() { throw new Error('Must be implemented by child class'); }
  buildEncounterResourceWithId() { throw new Error('Must be implemented by child class'); }
}

export default BaseClaimMapper;
