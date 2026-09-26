/**
 * NPHIES Professional Claim Mapper
 * Profile: http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/professional-claim
 * Reference: https://portal.nphies.sa/ig/Claim-173386.json.html
 * 
 * This mapper extends the Prior Auth ProfessionalMapper and adds claim-specific fields:
 * - use: 'claim' (instead of 'preauthorization')
 * - eventCoding: 'claim-request' (instead of 'priorauth-request')
 * - profile: professional-claim (instead of professional-priorauth)
 * - encounter.status: 'finished' (instead of 'planned' or 'in-progress')
 * 
 * Bundle Structure (per NPHIES example Claim-173386):
 * - MessageHeader (eventCoding = claim-request)
 * - Claim (professional-claim profile)
 * - Encounter (REQUIRED for professional claims - AMB/EMER/HH/VR profiles)
 * - Coverage
 * - Practitioner
 * - Organization (Provider)
 * - Organization (Insurer)
 * - Patient
 * 
 * Claim-Level Extensions (per NPHIES example):
 * - extension-encounter (REQUIRED)
 * - extension-authorization-offline-date (optional)
 * - extension-episode (REQUIRED)
 * 
 * Required SupportingInfo categories for Professional Claims:
 * - vital-sign-* (systolic, diastolic, height, weight, pulse, temperature)
 * - chief-complaint (REQUIRED - BV-00779)
 * - oxygen-saturation
 * - respiratory-rate
 * - patient-history (REQUIRED - BV-00804)
 * - investigation-result (REQUIRED - BV-00752)
 * - treatment-plan (REQUIRED - BV-00803)
 * - physical-examination (REQUIRED - BV-00805)
 * - history-of-present-illness (REQUIRED - BV-00806)
 * 
 * Item Extensions (required):
 * - extension-patient-share (Money)
 * - extension-package (boolean)
 * - extension-tax (Money)
 * - extension-patientInvoice (Identifier) - REQUIRED for claims
 * - extension-maternity (boolean)
 */

import ProfessionalPAMapper from '../priorAuthMapper/ProfessionalMapper.js';
import { NPHIES_CONFIG } from '../../config/nphies.js';
import {
  cloneInput, mappingError, roundMoney, requireProviderLicense, requireInsurerLicense, formatSaudiDate, ICD10_SYSTEM
} from '../priorAuthMapper/nphiesIdentity.js';

class ProfessionalClaimMapper extends ProfessionalPAMapper {
  constructor() {
    super();
    this.claimType = 'professional';
  }

  /**
   * Get the NPHIES Professional Claim profile URL (override PA profile)
   */
  getClaimProfileUrl() {
    return 'http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/professional-claim|1.0.0';
  }

  /** Claims use Claim.use=claim and the provider's /claim identifier system. */
  getClaimUse() {
    return 'claim';
  }

  /**
   * Build complete Claim Request Bundle for Professional type
   * Per NPHIES example Claim-173386.json:
   * - Encounter IS required
   * - Practitioner IS required
   * - preAuthRef may be included in insurance
   */
  buildClaimRequestBundle(data) {
    const { patient, provider, insurer, coverage, policyHolder, motherPatient } = data;
    // Deep copy: mapping must never mutate the caller's record
    const claim = cloneInput(data.claim);
    const practitioner = data.practitioner || claim.practitioner;

    const bundleResourceIds = {
      claim: this.generateId(),
      patient: patient.patient_id || this.generateId(),
      provider: provider.provider_id || this.generateId(),
      insurer: insurer.insurer_id || this.generateId(),
      coverage: coverage?.id || coverage?.coverage_id || this.generateId(),
      encounter: this.generateId(),
      practitioner: practitioner?.practitioner_id || this.generateId(),
      policyHolder: policyHolder?.id || this.generateId(),
      motherPatient: (claim.is_newborn && motherPatient) ? (motherPatient.patient_id || this.generateId()) : null
    };
    const locationResource = this.buildFacilityLocationWithId(provider, this.generateId(), bundleResourceIds.provider);
    bundleResourceIds.location = locationResource?.resource.id || null;

    // For newborn cases, patient is the newborn, and we also need mother patient resource
    const newbornPatientResource = this.buildPatientResourceWithId(patient, bundleResourceIds.patient);
    const providerResource = this.buildProviderOrganizationWithId(provider, bundleResourceIds.provider);
    const insurerResource = this.buildInsurerOrganizationWithId(insurer, bundleResourceIds.insurer);
    
    // Build mother patient resource if provided (for newborn requests)
    const motherPatientResource = (claim.is_newborn && motherPatient && bundleResourceIds.motherPatient) 
      ? this.buildPatientResourceWithId(motherPatient, bundleResourceIds.motherPatient) 
      : null;
    
    // For newborn cases, pass motherPatient and motherPatientId to buildCoverageResourceWithId
    const coverageResource = this.buildCoverageResourceWithId(
      coverage, 
      patient, 
      insurer, 
      policyHolder, 
      bundleResourceIds,
      motherPatient,
      bundleResourceIds.motherPatient
    );
    const practitionerResource = this.buildPractitionerResourceWithId(
      practitioner,
      bundleResourceIds.practitioner
    );
    
    // Build Encounter resource for claims (status: finished)
    const encounterResource = this.buildClaimEncounterResource(claim, patient, provider, bundleResourceIds);
    
    // Build Claim resource
    const claimResource = this.buildProfessionalClaimResource(
      claim, patient, provider, insurer, coverage, 
      encounterResource?.resource, practitioner, bundleResourceIds
    );
    
    const messageHeader = this.buildClaimMessageHeader(provider, insurer, claimResource.fullUrl);

    // NOTE: Attachments should NOT be added as separate Binary resources
    // They are already included in supportingInfo as valueAttachment (embedded data)
    // Adding Binary resources causes GE-00013 error (invalid meta structure)
    // Following NPHIES examples: attachments are embedded in supportingInfo only

    // Bundle entries per NPHIES example order
    const entries = [
      messageHeader,
      claimResource,
      encounterResource,
      coverageResource,
      practitionerResource,
      providerResource,
      insurerResource,
      locationResource, // Claim.facility target (when the provider has a location license)
      newbornPatientResource, // Newborn patient
      ...(motherPatientResource ? [motherPatientResource] : []) // Mother patient if present
    ].filter(Boolean);

    return {
      resourceType: 'Bundle',
      id: this.generateId(),
      meta: {
        profile: ['http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/bundle|1.0.0']
      },
      type: 'message',
      timestamp: this.formatDateTime(new Date()),
      entry: entries
    };
  }

  /**
   * Build MessageHeader for Claim Request (override PA message header)
   */
  buildClaimMessageHeader(provider, insurer, focusFullUrl) {
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
          code: 'claim-request'  // Changed from 'priorauth-request'
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
   * Build FHIR Claim resource for Professional Claim
   * Reference: https://portal.nphies.sa/ig/Claim-173386.json.html
   * 
   * Key differences from Prior Auth:
   * - use: 'claim' (not 'preauthorization')
   * - profile: professional-claim
   * - insurance.preAuthRef may be included
   * - extension-patientInvoice on items is REQUIRED
   * - extension-tax on items is REQUIRED
   * - Required supportingInfo categories for claims
   */
  buildProfessionalClaimResource(claim, patient, provider, insurer, coverage, encounter, practitioner, bundleResourceIds) {
    const claimId = bundleResourceIds.claim;
    const patientRef = bundleResourceIds.patient;
    const providerRef = bundleResourceIds.provider;
    const insurerRef = bundleResourceIds.insurer;
    const coverageRef = bundleResourceIds.coverage;
    const encounterRef = bundleResourceIds.encounter;
    const practitionerRef = bundleResourceIds.practitioner;

    const providerIdentifierSystem = this.getProviderIdentifierSystem(provider);

    // Build claim-level extensions per NPHIES example Claim-173386
    const extensions = [];

    // 1. Encounter extension (REQUIRED for professional claims)
    extensions.push({
      url: 'http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-encounter',
      valueReference: {
        reference: `Encounter/${encounterRef}`
      }
    });

    // 2. Authorization offline date or online priorauthresponse at Claim level
    if (claim.authorization_offline_reference) {
      extensions.push({
        url: 'http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-authorization-offline-date',
        valueDateTime: this.formatDateTimeWithTimezone(claim.authorization_offline_date || claim.service_date || new Date())
      });
    } else if (claim.pre_auth_ref) {
      extensions.push({
        url: 'http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-priorauthresponse',
        valueReference: {
          identifier: {
            system: `http://${NPHIES_CONFIG.INSURER_DOMAIN}.com.sa/identifiers/claimresponse`,
            value: claim.pa_nphies_response_id || claim.pre_auth_ref
          }
        }
      });
    }

    // 3. Episode extension (REQUIRED)
    const episodeId = claim.episode_id || claim.episode_identifier || `provider_EpisodeID_${claim.claim_number || Date.now()}`;
    extensions.push({
      url: 'http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-episode',
      valueIdentifier: {
        system: `${providerIdentifierSystem}/episode`,
        value: episodeId
      }
    });

    // 4. AccountingPeriod (REQUIRED per error IC-01620)
    // Per NPHIES spec, this extension requires valueDate (NOT valuePeriod)
    // Per NPHIES error BV-01010, the day must be "01" (first day of month)
    // Saudi calendar month (independent of the host timezone)
    const accountingPeriodDate = `${formatSaudiDate(claim.accounting_period_start || claim.service_date || new Date()).slice(0, 7)}-01`;
    extensions.push({
      url: 'http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-accountingPeriod',
      valueDate: accountingPeriodDate
    });

    // 6. Eligibility offline reference (optional)
    if (claim.eligibility_offline_ref) {
      extensions.push({
        url: 'http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-eligibility-offline-reference',
        valueString: claim.eligibility_offline_ref
      });
    }

    // 7. Eligibility offline date (optional)
    if (claim.eligibility_offline_date) {
      extensions.push({
        url: 'http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-eligibility-offline-date',
        valueDateTime: this.formatDate(claim.eligibility_offline_date)
      });
    }

    // 7b. Eligibility response (online) - identifier-based reference to CoverageEligibilityResponse
    if (claim.eligibility_response_id) {
      const identifierSystem = claim.eligibility_response_system || 
        `http://${NPHIES_CONFIG.INSURER_DOMAIN}.com.sa/identifiers/coverageeligibilityresponse`;
      extensions.push({
        url: 'http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-eligibility-response',
        valueReference: {
          identifier: { system: identifierSystem, value: claim.eligibility_response_id }
        }
      });
    } else if (claim.eligibility_ref && !claim.eligibility_offline_ref) {
      const refValue = claim.eligibility_ref.includes('/')
        ? claim.eligibility_ref.split('/').pop()
        : claim.eligibility_ref;
      const identifierSystem = claim.eligibility_response_system || 
        `http://${NPHIES_CONFIG.INSURER_DOMAIN}.com.sa/identifiers/coverageeligibilityresponse`;
      extensions.push({
        url: 'http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-eligibility-response',
        valueReference: {
          identifier: { system: identifierSystem, value: refValue }
        }
      });
    }

    // 9. Newborn extension - for newborn patient claims
    // Reference: https://portal.nphies.sa/ig/StructureDefinition-extension-newborn.html
    if (claim.is_newborn) {
      extensions.push({
        url: 'http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-newborn',
        valueBoolean: true
      });
    }

    // Build claim resource following NPHIES professional-claim profile
    const claimResource = {
      resourceType: 'Claim',
      id: claimId,
      meta: {
        profile: [this.getClaimProfileUrl()]
      }
    };

    // Add extensions
    if (extensions.length > 0) {
      claimResource.extension = extensions;
    }

    // Identifier (required)
    claimResource.identifier = [
      {
        system: this.getClaimIdentifierSystem(provider),
        value: claim.claim_number || `req_${Date.now()}`
      }
    ];

    // Status (required)
    claimResource.status = 'active';

    // Type (required) - must be 'professional'
    claimResource.type = {
      coding: [
        {
          system: 'http://terminology.hl7.org/CodeSystem/claim-type',
          code: 'professional'
        }
      ]
    };

    // BV-00365, BV-00034: Professional claims MUST use OP or EMR subType only
    let subTypeCode = claim.sub_type || this.getClaimSubTypeCode(claim.encounter_class || 'ambulatory', 'professional');
    if (!['op', 'emr'].includes(subTypeCode)) {
      console.warn(`[ProfessionalClaimMapper] Invalid subType '${subTypeCode}' corrected to 'op' (BV-00365, BV-00034)`);
      subTypeCode = 'op';
    }
    claimResource.subType = {
      coding: [
        {
          system: 'http://nphies.sa/terminology/CodeSystem/claim-subtype',
          code: subTypeCode
        }
      ]
    };

    // Use (required) - 'claim' for claims (not 'preauthorization')
    claimResource.use = 'claim';

    // Patient reference (required)
    claimResource.patient = { reference: `Patient/${patientRef}` };

    // Created date (required)
    claimResource.created = this.formatDateTimeWithTimezone(claim.request_date || new Date());

    // Insurer reference (required)
    claimResource.insurer = { reference: `Organization/${insurerRef}` };

    // Provider reference (required)
    claimResource.provider = { reference: `Organization/${providerRef}` };

    // BV-00905: facility for ambulatory/virtual encounters; must reference a Location
    const encounterClassCode = encounter?.class?.code;
    if ((encounterClassCode === 'AMB' || encounterClassCode === 'VR') && bundleResourceIds.location) {
      claimResource.facility = { reference: `Location/${bundleResourceIds.location}` };
    }

    // Priority (required)
    claimResource.priority = {
      coding: [
        {
          system: 'http://terminology.hl7.org/CodeSystem/processpriority',
          code: claim.priority || 'normal'
        }
      ]
    };

    // Payee (optional but typically included)
    claimResource.payee = {
      type: {
        coding: [
          {
            system: 'http://terminology.hl7.org/CodeSystem/payeetype',
            code: claim.payee_type || 'provider'
          }
        ]
      }
    };

    // CareTeam (required)
    const pract = practitioner || claim.practitioner || {};
    const practiceCode = claim.practice_code || pract.practice_code || pract.specialty_code || '08.00';
    claimResource.careTeam = [
      {
        sequence: 1,
        provider: { reference: `Practitioner/${practitionerRef}` },
        role: {
          coding: [
            {
              system: 'http://terminology.hl7.org/CodeSystem/claimcareteamrole',
              code: 'primary'
            }
          ]
        },
        qualification: {
          coding: [
            {
              system: 'http://nphies.sa/terminology/CodeSystem/practice-codes',
              code: practiceCode
            }
          ]
        }
      }
    ];

    // SupportingInfo - Build with required categories per NPHIES professional claim example
    const supportingInfoResult = this.buildProfessionalClaimSupportingInfo(claim, providerIdentifierSystem);
    claimResource.supportingInfo = supportingInfoResult.supportingInfo;
    const supportingInfoSequences = supportingInfoResult.sequences;
    const informationSequenceMap = supportingInfoResult.informationSequenceMap;

    // Diagnosis (required - at least one)
    // IMPORTANT: Per NPHIES error IB-00242, diagnosis system MUST be icd-10-am, NOT icd-10
    if (claim.diagnoses && claim.diagnoses.length > 0) {
      claimResource.diagnosis = claim.diagnoses.map((diag, idx) => {
        // Force correct ICD-10-AM system
        let diagSystem = diag.diagnosis_system || ICD10_SYSTEM;
        if (diagSystem === 'http://hl7.org/fhir/sid/icd-10' || 
            diagSystem === 'icd-10' || 
            diagSystem === 'ICD-10') {
          diagSystem = ICD10_SYSTEM;
        }
        
        return {
          sequence: diag.sequence || idx + 1,
          diagnosisCodeableConcept: {
            coding: [
              {
                system: diagSystem,
                code: diag.diagnosis_code,
                display: diag.diagnosis_display
              }
            ]
          },
          type: [
            {
              coding: [
                {
                  system: 'http://nphies.sa/terminology/CodeSystem/diagnosis-type',
                  code: diag.diagnosis_type || 'principal'
                }
              ]
            }
          ]
          // Note: NO onAdmission for professional claims per NPHIES spec
        };
      });
    }

    const insuranceEntry = {
      sequence: 1,
      focal: true,
      coverage: { reference: `Coverage/${coverageRef}` }
    };

    if (claim.authorization_offline_reference) {
      insuranceEntry.preAuthRef = [claim.authorization_offline_reference];
    }

    claimResource.insurance = [insuranceEntry];

    // Items with claim-specific extensions
    const encounterPeriod = {
      start: claim.encounter_start || claim.service_date || new Date(),
      end: claim.encounter_end
    };

    let builtItems = [];
    if (claim.items && claim.items.length > 0) {
      builtItems = claim.items.map((item, idx) => 
        this.buildProfessionalClaimItem(item, idx + 1, supportingInfoSequences, encounterPeriod, providerIdentifierSystem, claim, informationSequenceMap)
      );
      claimResource.item = builtItems;
    }

    // Total (required) - MUST equal sum of all item.net values per BV-00059
    let totalAmount = 0;
    if (builtItems.length > 0) {
      totalAmount = builtItems.reduce((sum, item) => {
        return sum + (item.net?.value || 0);
      }, 0);
    } else if (claim.total_amount) {
      totalAmount = parseFloat(claim.total_amount);
    }
    claimResource.total = {
      value: roundMoney(totalAmount),
      currency: claim.currency || 'SAR'
    };

    return {
      fullUrl: `http://provider.com/Claim/${claimId}`,
      resource: claimResource
    };
  }

  /**
   * Build supportingInfo for Professional Claims
   * Per NPHIES example Claim-173386, professional claims require:
   * - Vital signs (systolic, diastolic, height, weight, pulse, temperature, oxygen-saturation, respiratory-rate)
   * - chief-complaint (REQUIRED - BV-00779)
   * - patient-history (REQUIRED - BV-00804)
   * - investigation-result (REQUIRED - BV-00752)
   * - treatment-plan (REQUIRED - BV-00803)
   * - physical-examination (REQUIRED - BV-00805)
   * - history-of-present-illness (REQUIRED - BV-00806)
   */
  buildProfessionalClaimSupportingInfo(claim, providerIdentifierSystem) {
    const existingSupportingInfo = this.tagCallerSupportingInfo(claim.supporting_info);
    let supportingInfoList = [];
    let sequenceNum = 1;
    const sequences = [];
    // Caller entry -> final sequence, so item.information_sequences can be remapped
    const numbered = [];
    const add = (entry, sourceInfo = null) => {
      entry.sequence = sequenceNum;
      supportingInfoList.push(entry);
      if (sourceInfo) numbered.push({ info: sourceInfo, sequence: sequenceNum });
      sequences.push(sequenceNum++);
    };
    const category = code => ({
      coding: [{
        system: 'http://nphies.sa/terminology/CodeSystem/claim-information-category',
        code
      }]
    });

    // Valid investigation-result codes per NPHIES CodeSystem
    const validInvestigationCodes = ['INP', 'IRA', 'other', 'NA', 'IRP'];
    const investigationCodeDisplayMap = {
      'INP': 'Investigation(s) not performed',
      'IRA': 'Investigation results attached',
      'other': 'Other',
      'NA': 'Not applicable',
      'IRP': 'Investigation results pending'
    };
    
    // Helper to get existing supporting info by category
    const getExisting = (cat) => existingSupportingInfo.find(info => 
      (info.category || '').toLowerCase() === cat.toLowerCase()
    );
    const hasValue = value => value !== undefined && value !== null && value !== '';

    // Vital signs: only measured values, timed when they were taken (or the encounter start).
    // Nothing is sent for a category without a value; no placeholder vitals.
    const vitalTiming = existing => {
      const start = existing?.timing_period_start || existing?.timing_start || existing?.timing_date || claim.encounter_start || claim.service_date;
      if (!start) return {};
      const end = existing?.timing_period_end || existing?.timing_end || start;
      return { timingPeriod: { start: this.formatDateTimeWithTimezone(start), end: this.formatDateTimeWithTimezone(end) } };
    };
    const addVital = (cat, vitalKey, ucum, parse = parseInt) => {
      const existing = getExisting(cat);
      const raw = hasValue(existing?.value_quantity) ? existing.value_quantity : claim.vital_signs?.[vitalKey];
      if (!hasValue(raw) || !Number.isFinite(parse(raw))) return;
      add({
        category: category(cat),
        ...vitalTiming(existing),
        valueQuantity: {
          value: parse(raw),
          system: 'http://unitsofmeasure.org',
          code: ucum
        }
      }, existing);
    };
    const requireNarrative = (cat, claimField, bvCode) => {
      const existing = getExisting(cat);
      const text = existing?.value_string || claim[claimField];
      if (!hasValue(text)) {
        throw mappingError(`Professional claim requires ${cat} (${bvCode}): supporting_info category ${cat} or ${claimField}`);
      }
      add({ category: category(cat), valueString: text }, existing);
    };

    addVital('vital-sign-systolic', 'systolic', 'mm[Hg]');
    addVital('vital-sign-diastolic', 'diastolic', 'mm[Hg]');
    addVital('vital-sign-height', 'height', 'cm');
    addVital('vital-sign-weight', 'weight', 'kg');
    addVital('pulse', 'pulse', '/min');
    addVital('temperature', 'temperature', 'Cel', parseFloat);

    // chief-complaint (REQUIRED - BV-00779); never a default complaint
    const existingChiefComplaint = getExisting('chief-complaint');
    const chiefComplaintEntry = { category: category('chief-complaint') };
    
    // Per NPHIES example Claim-173386, chief-complaint uses code.coding for SNOMED codes
    if (existingChiefComplaint?.code) {
      chiefComplaintEntry.code = {
        coding: [{
          system: existingChiefComplaint.code_system || 'http://snomed.info/sct',
          code: existingChiefComplaint.code,
          display: existingChiefComplaint.code_display || existingChiefComplaint.code_text
        }]
      };
    } else if (claim.chief_complaint_code) {
      chiefComplaintEntry.code = {
        coding: [{
          system: 'http://snomed.info/sct',
          code: claim.chief_complaint_code,
          display: claim.chief_complaint || claim.chief_complaint_display
        }]
      };
    } else {
      // Free text format - use code.text per NPHIES spec
      const text = existingChiefComplaint?.code_text || existingChiefComplaint?.value_string || claim.chief_complaint;
      if (!hasValue(text)) {
        throw mappingError('Professional claim requires a chief complaint (BV-00779): supporting_info category chief-complaint or chief_complaint');
      }
      chiefComplaintEntry.code = { text };
    }
    add(chiefComplaintEntry, existingChiefComplaint);

    addVital('oxygen-saturation', 'oxygen_saturation', '%');
    addVital('respiratory-rate', 'respiratory_rate', '/min');

    // patient-history (REQUIRED - BV-00804)
    requireNarrative('patient-history', 'patient_history', 'BV-00804');

    // investigation-result (REQUIRED - BV-00752): the user's own coded result only
    const existingInvestigation = getExisting('investigation-result');
    const investigationResultCode = existingInvestigation?.code || claim.investigation_result_code;
    if (!validInvestigationCodes.includes(investigationResultCode)) {
      throw mappingError(`Professional claim requires an investigation-result code (BV-00752), one of ${validInvestigationCodes.join(', ')}`);
    }
    add({
      category: category('investigation-result'),
      code: {
        coding: [{
          system: 'http://nphies.sa/terminology/CodeSystem/investigation-result',
          code: investigationResultCode,
          display: existingInvestigation?.code_display || investigationCodeDisplayMap[investigationResultCode]
        }]
      }
    }, existingInvestigation);

    // treatment-plan (REQUIRED - BV-00803), physical-examination (BV-00805),
    // history-of-present-illness (BV-00806): documented narrative only
    requireNarrative('treatment-plan', 'treatment_plan', 'BV-00803');
    requireNarrative('physical-examination', 'physical_examination', 'BV-00805');
    requireNarrative('history-of-present-illness', 'history_of_present_illness', 'BV-00806');

    // Add birth-weight supportingInfo for newborn patients
    // Reference: https://portal.nphies.sa/ig/StructureDefinition-extension-newborn.html
    // Per NPHIES Test Case 8: Newborn claim should include birth-weight
    // BV-00509: birth-weight valueQuantity SHALL use 'kg' code from UCUM
    const existingBirthWeight = getExisting('birth-weight');
    if (existingBirthWeight) {
      add(this.buildSupportingInfo({ ...existingBirthWeight, sequence: sequenceNum }), existingBirthWeight);
    } else if (claim.is_newborn && claim.birth_weight) {
      // Convert grams to kilograms for NPHIES (BV-00509 requires kg)
      add({
        category: category('birth-weight'),
        valueQuantity: {
          value: parseFloat(claim.birth_weight) / 1000,
          system: 'http://unitsofmeasure.org',
          code: 'kg'
        }
      });
    }

    // BV-00428: Onset requires both timingDate AND ICD-10 code for symptoms/illness
    const existingOnset = getExisting('onset');
    if (existingOnset) {
      const onsetDate = existingOnset.timing_date || claim.encounter_start || claim.service_date;
      const principalDiag = (claim.diagnoses || []).find(d =>
        (d.diagnosis_type || 'principal').toLowerCase() === 'principal'
      ) || (claim.diagnoses || [])[0];

      if (onsetDate && principalDiag?.diagnosis_code) {
        add({
          category: category('onset'),
          code: {
            coding: [{
              system: ICD10_SYSTEM,
              code: principalDiag.diagnosis_code,
              display: principalDiag.diagnosis_display
            }]
          },
          timingDate: this.formatDate(onsetDate)
        }, existingOnset);
      }
    }

    // Pass through any remaining supporting info categories not explicitly handled above
    // (e.g., lab-test, reason-for-visit, attachment, etc.) so they are not silently dropped.
    const handled = new Set(numbered.map(({ info }) => info));
    const handledCategories = new Set([
      'vital-sign-systolic', 'vital-sign-diastolic', 'vital-sign-height', 'vital-sign-weight',
      'pulse', 'temperature', 'chief-complaint', 'oxygen-saturation', 'respiratory-rate',
      'patient-history', 'investigation-result', 'treatment-plan',
      'physical-examination', 'history-of-present-illness', 'birth-weight',
      'onset'
    ]);
    existingSupportingInfo.forEach(info => {
      const cat = (info.category || '').toLowerCase();
      if (!handledCategories.has(cat) && !handled.has(info)) {
        add(this.buildSupportingInfo({ ...info, sequence: sequenceNum }), info);
      }
    });

    return {
      supportingInfo: supportingInfoList,
      sequences: sequences,
      informationSequenceMap: this.buildInformationSequenceMap(numbered)
    };
  }

  /**
   * Build claim item for Professional Claim with all required extensions
   * Reference: https://portal.nphies.sa/ig/Claim-173386.json.html
   * 
   * Required Extensions for Professional Claim Items:
   * - extension-patient-share (Money) - patient's share amount
   * - extension-package (boolean) - whether item is a package
   * - extension-tax (Money) - tax amount (REQUIRED for claims)
   * - extension-patientInvoice (Identifier) - REQUIRED for claims
   * - extension-maternity (boolean) - maternity related
   */
  buildProfessionalClaimItem(item, itemIndex, supportingInfoSequences, encounterPeriod, providerIdentifierSystem, claim, informationSequenceMap = null) {
    const sequence = item.sequence || itemIndex;
    
    const quantity = parseFloat(item.quantity || 1);
    const unitPrice = parseFloat(item.unit_price || 0);
    const factor = parseFloat(item.factor ?? 1);
    const tax = parseFloat(item.tax || 0);
    
    const calculatedNet = (quantity * unitPrice * factor) + tax;
    const patientShare = parseFloat(item.patient_share || 0);
    
    // Build professional-specific extensions per NPHIES claim example
    const itemExtensions = [];

    // 1. extension-patient-share (required)
    itemExtensions.push({
      url: 'http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-patient-share',
      valueMoney: {
        value: patientShare,
        currency: item.currency || claim?.currency || 'SAR'
      }
    });

    // 2. extension-package (required)
    itemExtensions.push({
      url: 'http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-package',
      valueBoolean: item.is_package || false
    });

    // 3. extension-tax (required for claims)
    itemExtensions.push({
      url: 'http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-tax',
      valueMoney: {
        value: tax,
        currency: item.currency || claim?.currency || 'SAR'
      }
    });

    // 4. extension-patientInvoice (REQUIRED for claims)
    const patientInvoice = item.patient_invoice || `Invc-${this.formatDate(new Date()).replace(/-/g, '')}/${claim?.claim_number || 'OP-' + Date.now()}`;
    itemExtensions.push({
      url: 'http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-patientInvoice',
      valueIdentifier: {
        system: `${providerIdentifierSystem}/patientInvoice`,
        value: patientInvoice
      }
    });

    // 5. extension-maternity (required)
    itemExtensions.push({
      url: 'http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-maternity',
      valueBoolean: item.is_maternity || false
    });

    // Build the claim item
    const claimItem = {
      factor,
      extension: itemExtensions,
      sequence: sequence,
      careTeamSequence: [1],
      diagnosisSequence: item.diagnosis_sequences || [1]
    };
    // Supporting info the user linked to this item, remapped to the renumbered list
    if (Array.isArray(item.information_sequences) && item.information_sequences.length > 0) {
      const informationSequence = this.resolveInformationSequences(item, supportingInfoSequences, informationSequenceMap);
      if (informationSequence) claimItem.informationSequence = informationSequence;
    }

    // ProductOrService (required) - Use provided system or default to NPHIES services CodeSystem
    // Per NPHIES IB-00030: Professional Claims require codes from services ValueSet
    // Prior Authorization uses procedures CodeSystem, Claims use services CodeSystem
    // Reference: https://portal.nphies.sa/ig/Claim-173386.json.html (services)
    // Reference: https://portal.nphies.sa/ig/Claim-173086.json.html (procedures for PA)
    const productCode = item.product_or_service_code || item.service_code;
    const productDisplay = item.product_or_service_display || item.service_display;
    
    if (!productCode) {
      console.error(`[ProfessionalClaimMapper] ERROR: Item ${sequence} missing product_or_service_code`);
      throw new Error(`Service code (product_or_service_code) is required for professional claim item ${sequence}`);
    }
    
    // Use provided system or default to services for professional claims
    // Valid systems: procedures, imaging, laboratory, services, lens-type, practice-codes
    const defaultSystem = 'http://nphies.sa/terminology/CodeSystem/services';
    const providedSystem = item.product_or_service_system;
    
    const productOrServiceCoding = {
      system: providedSystem || defaultSystem,
      code: productCode
    };
    
    if (productDisplay) {
      productOrServiceCoding.display = productDisplay;
    }
    
    const productOrServiceCodings = [productOrServiceCoding];
    if (item.shadow_code && item.shadow_code_system) {
      const shadowCoding = {
        system: item.shadow_code_system,
        code: item.shadow_code
      };
      if (item.shadow_code_display) {
        shadowCoding.display = item.shadow_code_display;
      }
      productOrServiceCodings.push(shadowCoding);
    }
    
    claimItem.productOrService = {
      coding: productOrServiceCodings
    };

    // Serviced date - must be within encounter period per BV-00041
    claimItem.servicedDate = this.resolveServicedDate(item.serviced_date, encounterPeriod);

    // Quantity (required)
    claimItem.quantity = { value: quantity };

    // UnitPrice (required)
    claimItem.unitPrice = {
      value: unitPrice,
      currency: item.currency || claim?.currency || 'SAR'
    };

    // Net (required)
    claimItem.net = {
      value: calculatedNet,
      currency: item.currency || claim?.currency || 'SAR'
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
                system: detail.product_or_service_system || item.product_or_service_system || 'http://nphies.sa/terminology/CodeSystem/services',
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
            currency: detail.currency || item.currency || claim?.currency || 'SAR' 
          },
          factor: detailFactor,
          net: { 
            value: detailNet, 
            currency: detail.currency || item.currency || claim?.currency || 'SAR' 
          }
        };
      });
    }

    return claimItem;
  }

  /**
   * Build Encounter resource for Professional Claims (status: finished)
   * Reference: https://portal.nphies.sa/ig/Encounter-10131.json.html (from example)
   * 
   * Key differences from Prior Auth:
   * - status: 'finished' (instead of 'in-progress' or 'planned')
   * - hospitalization.dischargeDisposition may be included
   */
  buildClaimEncounterResource(claim, patient, provider, bundleResourceIds) {
    const encounterId = bundleResourceIds.encounter;
    const patientId = bundleResourceIds.patient;
    const providerId = bundleResourceIds.provider;
    
    let encounterClass = claim.encounter_class || 'ambulatory';
    
    // BV-00755: If subType=EMR then Encounter.class MUST be EMER
    const subTypeCode = claim.sub_type || 'op';
    if (subTypeCode === 'emr' && encounterClass !== 'emergency') {
      console.warn(`[ProfessionalClaimMapper] BV-00755 violation: subType=EMR requires encounter.class=EMER. Correcting encounter class from '${encounterClass}' to 'emergency'`);
      encounterClass = 'emergency';
    }
    const encounterIdentifier = claim.encounter_identifier || 
                                claim.claim_number || 
                                `ENC-${encounterId.substring(0, 8)}`;
    const providerNphiesId = NPHIES_CONFIG.PROVIDER_DOMAIN || 'provider';

    // Build extensions based on encounter class
    const extensions = [];

    // For Emergency encounters (EMER), add required emergency-specific extensions
    if (encounterClass === 'emergency') {
      // Triage Category - REQUIRED for EMER (BV-00734); a clinical assessment, never defaulted
      const triageCategory = claim.triage_category;
      if (!triageCategory) {
        throw mappingError('Emergency encounter requires a triage category (triage_category)');
      }
      extensions.push({
        url: 'http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-triageCategory',
        valueCodeableConcept: {
          coding: [{
            system: 'http://nphies.sa/terminology/CodeSystem/triage-category',
            code: triageCategory,
            display: this.getTriageCategoryDisplay(triageCategory)
          }]
        }
      });

      // Triage Date - REQUIRED for EMER (BV-00733)
      const triageDate = claim.triage_date || claim.encounter_start || new Date();
      extensions.push({
        url: 'http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-triageDate',
        valueDateTime: this.formatDateTimeWithTimezone(triageDate)
      });

      // Emergency Arrival Code - REQUIRED for EMER (BV-00732)
      // Per NPHIES ValueSet: https://portal.nphies.sa/ig/ValueSet-encounter-emergency-arrival.html
      // Valid codes: unknown, PV, ACDA, OGV, GCDA, other, MOHA, EMSAA, GMA, AMA, GEMSA, GPA, POV
      const arrivalCode = claim.emergency_arrival_code || claim.arrival_code;
      if (!arrivalCode) {
        throw mappingError('Emergency encounter requires an arrival code (emergency_arrival_code, BV-00732)');
      }
      extensions.push({
        url: 'http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-emergencyArrivalCode',
        valueCodeableConcept: {
          coding: [{
            system: 'http://nphies.sa/terminology/CodeSystem/emergency-arrival-code',
            code: arrivalCode,
            display: this.getEmergencyArrivalCodeDisplay(arrivalCode)
          }]
        }
      });

      // Emergency Service Start - REQUIRED for EMER (BV-00735)
      // Per NPHIES: Time when emergency service started
      const emergencyServiceStart = claim.emergency_service_start || claim.encounter_start || new Date();
      extensions.push({
        url: 'http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-emergencyServiceStart',
        valueDateTime: this.formatDateTimeWithTimezone(emergencyServiceStart)
      });

      // Transport Type for Emergency (optional) - only when documented
      const transportType = claim.transport_type;
      if (transportType) {
        extensions.push({
          url: 'http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-transportType',
          valueCodeableConcept: {
            coding: [{
              system: 'http://nphies.sa/terminology/CodeSystem/transport-type',
              code: transportType,
              display: this.getTransportTypeDisplay(transportType)
            }]
          }
        });
      }

      // BV-00728: Emergency Department Disposition (required when EMER + encounter end date)
      const edDisposition = claim.emergency_department_disposition;
      if (!edDisposition && claim.encounter_end) {
        throw mappingError('Emergency encounter with an end date requires an emergency department disposition (emergency_department_disposition, BV-00728)');
      }
      if (edDisposition) {
        extensions.push({
          url: 'http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-emergencyDepartmentDisposition',
          valueCodeableConcept: {
            coding: [{
              system: 'http://nphies.sa/terminology/CodeSystem/emergency-department-disposition',
              code: edDisposition,
              display: this.getEDDispositionDisplay(edDisposition)
            }]
          }
        });
      }

      // Diagnosis on Discharge for Emergency (optional)
      if (claim.discharge_diagnosis_code) {
        extensions.push({
          url: 'http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-diagnosisOnDischarge',
          valueCodeableConcept: {
            coding: [{
              system: ICD10_SYSTEM,
              code: claim.discharge_diagnosis_code,
              display: claim.discharge_diagnosis_display
            }]
          }
        });
      }
    }

    // Service Event Type - REQUIRED for professional encounters (BV-00736)
    const serviceEventType = claim.service_event_type || 'ICSE';
    extensions.push({
      url: 'http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-serviceEventType',
      valueCodeableConcept: {
        coding: [{
          system: 'http://nphies.sa/terminology/CodeSystem/service-event-type',
          code: serviceEventType,
          display: this.getServiceEventTypeDisplay(serviceEventType)
        }]
      }
    });

    // Discharge Date for claims (encounter is finished)
    if (claim.encounter_end || claim.discharge_date) {
      extensions.push({
        url: 'http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-dischargeDate',
        valueDateTime: this.formatDateTimeWithTimezone(claim.encounter_end || claim.discharge_date)
      });
    }

    const encounter = {
      resourceType: 'Encounter',
      id: encounterId,
      meta: {
        profile: [this.getEncounterProfileUrl(encounterClass)]
      }
    };

    // Add extensions if any
    if (extensions.length > 0) {
      encounter.extension = extensions;
    }

    encounter.identifier = [
      {
        system: `http://${providerNphiesId.toLowerCase().replace(/[^a-z0-9]/g, '')}.com.sa/identifiers/encounter`,
        value: encounterIdentifier
      }
    ];

    // Status - 'finished' for claims
    encounter.status = 'finished';

    // Class
    encounter.class = {
      system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
      code: this.getEncounterClassCode(encounterClass),
      display: this.getEncounterClassDisplay(encounterClass)
    };

    // Service Type (required)
    if (claim.service_type) {
      encounter.serviceType = {
        coding: [{
          system: 'http://nphies.sa/terminology/CodeSystem/service-type',
          code: claim.service_type,
          display: this.getServiceTypeDisplay(claim.service_type)
        }]
      };
    }

    // Priority for emergency encounters
    if (encounterClass === 'emergency' || claim.encounter_priority) {
      const priorityCode = claim.encounter_priority || 'EM';
      encounter.priority = {
        coding: [{
          system: 'http://terminology.hl7.org/CodeSystem/v3-ActPriority',
          code: priorityCode,
          display: this.getEncounterPriorityDisplay(priorityCode)
        }]
      };
    }

    // Subject
    encounter.subject = { reference: `Patient/${patientId}` };

    // Period
    // BV-00811: Date time format up to seconds SHALL be mandatory for claims
    // Always use full datetime format with seconds for all encounter types
    encounter.period = {
      start: this.formatDateTimeWithTimezone(claim.encounter_start || claim.service_date || new Date())
    };
    if (claim.encounter_end) {
      encounter.period.end = this.formatDateTimeWithTimezone(claim.encounter_end);
    }

    // ServiceProvider
    encounter.serviceProvider = { reference: `Organization/${providerId}` };

    return {
      fullUrl: `http://provider.com/Encounter/${encounterId}`,
      resource: encounter
    };
  }

  /**
   * Get transport type display text
   * Reference: http://nphies.sa/terminology/CodeSystem/transport-type
   */
  getTransportTypeDisplay(code) {
    const displays = {
      'GEMA': 'Ground EMS Ambulance',
      'AEMA': 'Air EMS Ambulance',
      'WEMA': 'Water EMS Ambulance',
      'OTHR': 'Other'
    };
    return displays[code] || code;
  }

  /**
   * Get emergency arrival code display text
   * Reference: https://portal.nphies.sa/ig/CodeSystem-emergency-arrival-code.html
   * Valid codes per NPHIES ValueSet: unknown, PV, ACDA, OGV, GCDA, other, MOHA, EMSAA, GMA, AMA, GEMSA, GPA, POV
   */
  getEmergencyArrivalCodeDisplay(code) {
    const displays = {
      'unknown': 'Not stated/unknown',
      'PV': 'Personal Vehicle',
      'ACDA': 'Air Civil Defense Ambulance',
      'OGV': 'Other Government Vehicles',
      'GCDA': 'Ground Civil Defense Ambulance',
      'other': 'Other',
      'MOHA': 'Ground MOH Ambulance',
      'EMSAA': 'EMS Air Ambulance',
      'GMA': 'Ground Military Ambulance',
      'AMA': 'Air Military Ambulance',
      'GEMSA': 'Ground EMS Ambulance',
      'GPA': 'Ground Private Ambulance',
      'POV': 'Police Vehicle'
    };
    return displays[code] || code;
  }

  getEDDispositionDisplay(code) {
    const displays = {
      'AH': 'Admitted to this hospital',
      'NAD': 'Non-admitted, departed',
      'NAR': 'Non-admitted, referred to another hospital',
      'DNW': 'Did not wait',
      'LAOR': 'Left at own risk',
      'DED': 'Died in ED',
      'DOA': 'Dead on arrival',
      'R': 'Registered, advised, left without being attended'
    };
    return displays[code] || code;
  }

  /**
   * Parse Claim Response
   * Inherits from parent but can be extended for professional-specific parsing
   */
  parseClaimResponse(responseBundle) {
    return this.parsePriorAuthResponse(responseBundle);
  }
}

export default ProfessionalClaimMapper;
