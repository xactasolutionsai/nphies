/**
 * NPHIES Dental (Oral) Prior Authorization Mapper
 * Profile: http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/oral-priorauth
 * 
 * Bundle Structure:
 * - MessageHeader (eventCoding = priorauth-request)
 * - Claim (oral-priorauth profile)
 * - Coverage
 * - Patient
 * - Organization (Provider)
 * - Organization (Insurer)
 * - Practitioner
 * - Encounter (AMB only - with serviceEventType extension)
 * 
 * Special Requirements:
 * - BV-00366: Must use 'op' subType
 * - BV-00743: Must use 'ambulatory' (AMB) encounter class
 * - BV-00736: serviceEventType extension is REQUIRED (ICSE/SCSE)
 * - chief-complaint is REQUIRED (SNOMED or free text)
 * - FDI tooth numbers (fdi-oral-region)
 * - Tooth surfaces (fdi-tooth-surface)
 * - ProductOrService uses oral-health-op CodeSystem
 * - NO hospitalization block allowed
 */

import BaseMapper from './BaseMapper.js';
import { NPHIES_CONFIG } from '../../config/nphies.js';

class DentalMapper extends BaseMapper {
  constructor() {
    super();
    this.authType = 'dental';
  }

  /**
   * Get FDI tooth display name
   */
  getFdiToothDisplay(toothNumber) {
    const permanentQuadrants = {
      '1': 'UPPER RIGHT', '2': 'UPPER LEFT', 
      '3': 'LOWER LEFT', '4': 'LOWER RIGHT'
    };
    const deciduousQuadrants = {
      '5': 'UPPER RIGHT', '6': 'UPPER LEFT',
      '7': 'LOWER LEFT', '8': 'LOWER RIGHT'
    };
    
    if (!toothNumber || toothNumber.length !== 2) {
      return `Tooth ${toothNumber}`;
    }
    
    const quadrantNum = toothNumber[0];
    const toothNum = toothNumber[1];
    
    if (['1', '2', '3', '4'].includes(quadrantNum)) {
      const quadrant = permanentQuadrants[quadrantNum];
      if (quadrant) return `${quadrant}; PERMANENT TEETH # ${toothNum}`;
    } else if (['5', '6', '7', '8'].includes(quadrantNum)) {
      const quadrant = deciduousQuadrants[quadrantNum];
      if (quadrant) return `${quadrant}; DECIDUOUS TEETH # ${toothNum}`;
    }
    
    return `Tooth ${toothNumber}`;
  }

  /**
   * Get tooth surface display name
   */
  getToothSurfaceDisplay(surfaceCode) {
    const surfaces = {
      'M': 'Mesial', 'O': 'Occlusal', 'I': 'Incisal',
      'D': 'Distal', 'B': 'Buccal', 'V': 'Ventral',
      'L': 'Lingual', 'F': 'Facial',
      'MO': 'Mesioclusal', 'DO': 'Distoclusal',
      'DI': 'Distoincisal', 'MOD': 'Mesioclusodistal'
    };
    return surfaces[surfaceCode?.toUpperCase()] || surfaceCode;
  }

  /**
   * Build complete Prior Authorization Request Bundle for Dental type
   */
  buildPriorAuthRequestBundle(data) {
    const { priorAuth, patient, provider, insurer, coverage, policyHolder, practitioner, motherPatient } = data;

    const bundleResourceIds = {
      claim: this.generateId(),
      patient: patient.patient_id || this.generateId(),
      provider: provider.provider_id || this.generateId(),
      insurer: insurer.insurer_id || this.generateId(),
      coverage: coverage?.id || coverage?.coverage_id || this.generateId(),
      encounter: this.generateId(),
      practitioner: practitioner?.practitioner_id || this.generateId(),
      policyHolder: policyHolder?.id || this.generateId(),
      motherPatient: (priorAuth.is_newborn && motherPatient) ? (motherPatient.patient_id || this.generateId()) : null
    };

    // For newborn cases, patient is the newborn, and we also need mother patient resource
    const newbornPatientResource = this.buildPatientResourceWithId(patient, bundleResourceIds.patient);
    const providerResource = this.buildProviderOrganizationWithId(provider, bundleResourceIds.provider);
    const insurerResource = this.buildInsurerOrganizationWithId(insurer, bundleResourceIds.insurer);
    
    // Build mother patient resource if provided (for newborn requests)
    const motherPatientResource = (priorAuth.is_newborn && motherPatient && bundleResourceIds.motherPatient) 
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
      practitioner || { name: 'Default Practitioner', specialty_code: '22.00' }, // Dental specialty
      bundleResourceIds.practitioner
    );
    const encounterResource = this.buildEncounterResourceWithId(priorAuth, patient, provider, bundleResourceIds);
    const claimResource = this.buildClaimResource(priorAuth, patient, provider, insurer, coverage, encounterResource?.resource, practitioner, bundleResourceIds);
    
    const messageHeader = this.buildMessageHeader(provider, insurer, claimResource.fullUrl);

    const binaryResources = [];
    if (priorAuth.attachments && priorAuth.attachments.length > 0) {
      priorAuth.attachments.forEach(attachment => {
        binaryResources.push(this.buildBinaryResource(attachment));
      });
    }

    const entries = [
      messageHeader,
      claimResource,
      encounterResource,
      coverageResource,
      practitionerResource,
      providerResource,
      insurerResource,
      newbornPatientResource, // Patient resource (named newbornPatientResource for consistency with other mappers)
      ...(motherPatientResource ? [motherPatientResource] : []), // Mother patient if present (for newborn cases)
      ...binaryResources
    ];

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
   * Build FHIR Claim resource for Dental Prior Authorization
   */
  buildClaimResource(priorAuth, patient, provider, insurer, coverage, encounter, practitioner, bundleResourceIds) {
    const claimId = bundleResourceIds.claim;
    const patientRef = bundleResourceIds.patient;
    const providerRef = bundleResourceIds.provider;
    const insurerRef = bundleResourceIds.insurer;
    const coverageRef = bundleResourceIds.coverage;
    const encounterRef = bundleResourceIds.encounter;
    const practitionerRef = bundleResourceIds.practitioner;

    const providerIdentifierSystem = provider.identifier_system || 
      `http://${(provider.provider_name || 'provider').toLowerCase().replace(/\s+/g, '')}.com.sa/identifiers`;

    // Build extensions
    const extensions = [];

    extensions.push({
      url: 'http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-encounter',
      valueReference: {
        reference: `Encounter/${encounterRef}`
      }
    });

    if (priorAuth.eligibility_offline_ref) {
      extensions.push({
        url: 'http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-eligibility-offline-reference',
        valueString: priorAuth.eligibility_offline_ref
      });
    }

    if (priorAuth.eligibility_offline_date) {
      extensions.push({
        url: 'http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-eligibility-offline-date',
        valueDateTime: this.formatDate(priorAuth.eligibility_offline_date)
      });
    }

    if (priorAuth.is_transfer) {
      extensions.push({
        url: 'http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-transfer',
        valueBoolean: true
      });
    }

    // Newborn extension - for newborn patient authorization requests
    // Reference: https://portal.nphies.sa/ig/StructureDefinition-extension-newborn.html
    if (priorAuth.is_newborn) {
      extensions.push({
        url: 'http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-newborn',
        valueBoolean: true
      });
    }

    // Only add eligibility reference if it's a valid FHIR reference format
    // Must be in format "ResourceType/id" (e.g., "CoverageEligibilityResponse/uuid")
    if (priorAuth.eligibility_ref && priorAuth.eligibility_ref.includes('/')) {
      extensions.push({
        url: 'http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-eligibility-response',
        valueReference: {
          reference: priorAuth.eligibility_ref
        }
      });
    }

    const claim = {
      resourceType: 'Claim',
      id: claimId,
      meta: {
        profile: [this.getAuthorizationProfileUrl('dental')]
      }
    };

    if (extensions.length > 0) {
      claim.extension = extensions;
    }

    claim.identifier = [
      {
        system: `${providerIdentifierSystem}/authorization`,
        value: priorAuth.request_number || `req_${Date.now()}`
      }
    ];
    claim.status = 'active';
    claim.type = {
      coding: [
        {
          system: 'http://terminology.hl7.org/CodeSystem/claim-type',
          code: 'oral'
        }
      ]
    };
    // BV-00366: Dental/Oral claims MUST use OP subType only
    if (priorAuth.sub_type && priorAuth.sub_type !== 'op') {
      console.warn(`[DentalMapper] Invalid subType '${priorAuth.sub_type}' corrected to 'op' (BV-00366)`);
    }
    claim.subType = {
      coding: [
        {
          system: 'http://nphies.sa/terminology/CodeSystem/claim-subtype',
          code: 'op' // Force OP always - BV-00366: Dental/Oral must be OP only
        }
      ]
    };
    claim.use = 'preauthorization';
    claim.patient = { reference: `Patient/${patientRef}` };
    claim.created = this.formatDateTime(priorAuth.request_date || new Date());
    claim.insurer = { reference: `Organization/${insurerRef}` };
    claim.provider = { reference: `Organization/${providerRef}` };
    claim.priority = {
      coding: [
        {
          system: 'http://terminology.hl7.org/CodeSystem/processpriority',
          code: priorAuth.priority || 'normal'
        }
      ]
    };
    claim.payee = {
      type: {
        coding: [
          {
            system: 'http://terminology.hl7.org/CodeSystem/payeetype',
            code: 'provider'
          }
        ]
      }
    };

    // Related (for resubmission of rejected/partial authorizations or updates)
    const related = this.buildClaimRelated(priorAuth, providerIdentifierSystem);
    if (related) {
      claim.related = related;
    }

    // CareTeam
    const pract = practitioner || priorAuth.practitioner || {};
    const practiceCode = priorAuth.practice_code || pract.practice_code || pract.specialty_code || '22.00'; // Dental default
    claim.careTeam = [
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

    // Diagnosis (BV-00027: NO onAdmission for dental)
    if (priorAuth.diagnoses && priorAuth.diagnoses.length > 0) {
      claim.diagnosis = priorAuth.diagnoses.map((diag, idx) => ({
        sequence: diag.sequence || idx + 1,
        diagnosisCodeableConcept: {
          coding: [
            {
              system: 'http://hl7.org/fhir/sid/icd-10-am',
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
        // NO onAdmission for dental claims
      }));
    }

    // SupportingInfo with REQUIRED chief-complaint
    let supportingInfoSequences = [];
    let supportingInfoList = [...(priorAuth.supporting_info || [])];
    
    // chief-complaint is REQUIRED for dental
    // BV-00531: For dental/oral claims, chief-complaint MUST use code.text format (free text)
    // NOT code.coding format - this is different from institutional/professional claims
    const existingChiefComplaint = supportingInfoList.find(info => info.category === 'chief-complaint');
    if (existingChiefComplaint) {
      // Convert any SNOMED code format to free text format for dental
      if (existingChiefComplaint.code && !existingChiefComplaint.code_text) {
        existingChiefComplaint.code_text = existingChiefComplaint.code_display || existingChiefComplaint.code || 'Dental complaint';
        delete existingChiefComplaint.code;
        delete existingChiefComplaint.code_system;
        delete existingChiefComplaint.code_display;
      }
    } else {
      // Add chief complaint if not present
      const clinicalInfo = priorAuth.clinical_info || {};
      // For dental, always use free text format (code.text)
      const chiefComplaintText = clinicalInfo.chief_complaint_text || 
                                  clinicalInfo.chief_complaint_display || 
                                  priorAuth.chief_complaint_display ||
                                  'Periodic oral examination';
      supportingInfoList.unshift({
        category: 'chief-complaint',
        code_text: chiefComplaintText
      });
    }

    // Add birth-weight supportingInfo for newborn patients
    // Reference: https://portal.nphies.sa/ig/StructureDefinition-extension-newborn.html
    // Per NPHIES Test Case 8: Newborn authorization should include birth-weight
    // BV-00509: birth-weight valueQuantity SHALL use 'kg' code from UCUM
    if (priorAuth.is_newborn && priorAuth.birth_weight) {
      const hasBirthWeight = supportingInfoList.some(info => info.category === 'birth-weight');
      if (!hasBirthWeight) {
        // Convert grams to kilograms for NPHIES (BV-00509 requires kg)
        const weightInKg = parseFloat(priorAuth.birth_weight) / 1000;
        supportingInfoList.push({
          category: 'birth-weight',
          value_quantity: weightInKg,
          value_quantity_unit: 'kg'  // NPHIES BV-00509: must use 'kg' from UCUM
        });
      }
    }
    
    if (supportingInfoList.length > 0) {
      claim.supportingInfo = supportingInfoList.map((info, idx) => {
        const seq = idx + 1;
        supportingInfoSequences.push(seq);
        
        // BV-00531: For dental claims, chief-complaint MUST use code.text format
        // Convert ANY format to code_text format for dental chief-complaint
        if (info.category === 'chief-complaint') {
          // Get the text from any available source
          const chiefComplaintText = info.code_text || 
                                      info.value_string || 
                                      info.code_display || 
                                      info.code || 
                                      'Dental complaint';
          
          const convertedInfo = {
            sequence: seq,
            category: 'chief-complaint',
            code_text: chiefComplaintText,
            timing_date: info.timing_date
          };
          // Explicitly NOT including: code, code_system, code_display, value_string
          return this.buildSupportingInfo(convertedInfo);
        }
        
        return this.buildSupportingInfo({ ...info, sequence: seq });
      });
    }

    // Insurance
    claim.insurance = [
      {
        sequence: 1,
        focal: true,
        coverage: { reference: `Coverage/${coverageRef}` }
      }
    ];

    // Items with dental-specific fields
    const encounterPeriod = {
      start: priorAuth.encounter_start || new Date(),
      end: null // Dental AMB encounters don't have end date
    };
    
    if (priorAuth.items && priorAuth.items.length > 0) {
      claim.item = priorAuth.items.map((item, idx) => 
        this.buildDentalClaimItem(item, idx + 1, supportingInfoSequences, encounterPeriod)
      );
    }

    // Total
    let totalAmount = priorAuth.total_amount;
    if (!totalAmount && priorAuth.items && priorAuth.items.length > 0) {
      totalAmount = priorAuth.items.reduce((sum, item) => {
        const quantity = parseFloat(item.quantity || 1);
        const unitPrice = parseFloat(item.unit_price || 0);
        const factor = parseFloat(item.factor || 1);
        const tax = parseFloat(item.tax || 0);
        return sum + (quantity * unitPrice * factor) + tax;
      }, 0);
    }
    claim.total = {
      value: parseFloat(totalAmount || 0),
      currency: priorAuth.currency || 'SAR'
    };

    return {
      fullUrl: `http://provider.com/Claim/${claimId}`,
      resource: claim
    };
  }

  /**
   * Build claim item for Dental with FDI tooth numbers and surfaces
   */
  buildDentalClaimItem(item, itemIndex, supportingInfoSequences, encounterPeriod) {
    const claimItem = this.buildClaimItem(item, 'dental', itemIndex, supportingInfoSequences, encounterPeriod);
    
    // Override productOrService to use oral-health-op system
    claimItem.productOrService = {
      coding: [
        {
          system: item.product_or_service_system || 'http://nphies.sa/terminology/CodeSystem/oral-health-op',
          code: item.product_or_service_code,
          display: item.product_or_service_display
        }
      ]
    };

    // Add tooth number using FDI oral region system
    if (item.tooth_number) {
      claimItem.bodySite = {
        coding: [
          {
            system: 'http://nphies.sa/terminology/CodeSystem/fdi-oral-region',
            code: item.tooth_number,
            display: item.tooth_display || this.getFdiToothDisplay(item.tooth_number)
          }
        ]
      };
      
      // Add tooth surfaces if provided
      if (item.tooth_surface) {
        claimItem.subSite = item.tooth_surface.split(',').map(surface => ({
          coding: [
            {
              system: 'http://nphies.sa/terminology/CodeSystem/fdi-tooth-surface',
              code: surface.trim(),
              display: this.getToothSurfaceDisplay(surface.trim())
            }
          ]
        }));
      }
    }

    return claimItem;
  }

  /**
   * Build Encounter resource for Dental auth type
   * BV-00743: Must use AMB encounter class
   * BV-00736: serviceEventType extension is REQUIRED
   */
  buildEncounterResourceWithId(priorAuth, patient, provider, bundleResourceIds) {
    const encounterId = bundleResourceIds.encounter;
    const patientId = bundleResourceIds.patient;
    const providerId = bundleResourceIds.provider;
    
    // BV-00743: Dental MUST use ambulatory
    const encounterClass = 'ambulatory';
    const encounterIdentifier = priorAuth.encounter_identifier || 
                                priorAuth.request_number || 
                                `ENC-${encounterId.substring(0, 8)}`;

    const encounter = {
      resourceType: 'Encounter',
      id: encounterId,
      meta: {
        profile: [this.getEncounterProfileUrl(encounterClass)]
      },
      // BV-00736: serviceEventType extension is REQUIRED for dental
      extension: [
        {
          url: 'http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-serviceEventType',
          valueCodeableConcept: {
            coding: [
              {
                system: 'http://nphies.sa/terminology/CodeSystem/service-event-type',
                code: priorAuth.service_event_type || 'ICSE',
                display: priorAuth.service_event_type === 'SCSE' 
                  ? 'Subsequent client service event' 
                  : 'Initial client service event'
              }
            ]
          }
        }
      ],
      identifier: [
        {
          system: `http://${NPHIES_CONFIG.PROVIDER_DOMAIN || 'provider'}.com.sa/identifiers/encounter`,
          value: encounterIdentifier
        }
      ],
      status: 'planned',
      class: {
        system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
        code: 'AMB',
        display: 'ambulatory'
      }
    };

    // ServiceType for dental
    encounter.serviceType = {
      coding: [
        {
          system: 'http://nphies.sa/terminology/CodeSystem/service-type',
          code: 'dental-care',
          display: 'Dental Care'
        }
      ]
    };

    // Subject
    encounter.subject = { reference: `Patient/${patientId}` };

    // Period - Dental uses dateTime format (BV-00811)
    encounter.period = {
      start: this.formatDateTimeWithTimezone(priorAuth.encounter_start || new Date())
    };
    // NO end date for dental AMB encounters

    // ServiceProvider
    encounter.serviceProvider = { reference: `Organization/${providerId}` };

    // NO hospitalization block for dental

    return {
      fullUrl: `http://provider.com/Encounter/${encounterId}`,
      resource: encounter
    };
  }
}

export default DentalMapper;

