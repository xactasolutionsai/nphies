/**
 * NPHIES Oral (Dental) Claim Mapper
 * Profile: http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/oral-claim
 * References: 
 *   - https://portal.nphies.sa/ig/Claim-173094.json.html (with priorAuthResponse)
 *   - https://portal.nphies.sa/ig/Claim-293094.json.html (without priorAuthResponse)
 * 
 * This mapper extends the Prior Auth DentalMapper and adds claim-specific fields:
 * - use: 'claim' (instead of 'preauthorization')
 * - eventCoding: 'claim-request' (instead of 'priorauth-request')
 * - profile: oral-claim (instead of oral-priorauth)
 * 
 * Required Extensions (per NPHIES validation):
 * - extension-accountingPeriod (REQUIRED per IC-01620, day must be "01" per BV-01010)
 * - extension-encounter (reference to Encounter resource - REQUIRED)
 * - extension-episode (identifier - REQUIRED)
 * - extension-priorauthresponse (if claim is from approved prior auth - optional)
 * 
 * Item Extensions (per NPHIES examples):
 * - extension-package (valueBoolean - required)
 * - extension-tax (valueMoney - required)
 * - extension-patient-share (valueMoney - required)
 * - extension-patientInvoice (valueIdentifier - required)
 * 
 * SupportingInfo:
 * - chief-complaint is REQUIRED for oral claims
 * - Can use code.text for free text OR code.coding for SNOMED coded complaints
 * 
 * Oral Claims REQUIRE:
 * - Encounter resource (AMB only with serviceEventType extension)
 * - bodySite for tooth number (FDI oral region system)
 * - subSite for tooth surfaces (FDI tooth surface system) - optional
 * - NO onAdmission on diagnosis
 * - NO hospitalization block
 * 
 * Total Calculation (BV-00059):
 * - Claim total MUST equal sum of all item net values
 */

import DentalMapper from '../priorAuthMapper/DentalMapper.js';
import { NPHIES_CONFIG } from '../../config/nphies.js';

class OralClaimMapper extends DentalMapper {
  constructor() {
    super();
    this.claimType = 'oral';
  }

  /**
   * Get the NPHIES Claim profile URL (override PA profile)
   */
  getClaimProfileUrl() {
    return 'http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/oral-claim|1.0.0';
  }

  /**
   * Build complete Claim Request Bundle for Oral (Dental) type
   * Includes Encounter resource (unlike Vision claims)
   */
  buildClaimRequestBundle(data) {
    const { claim, patient, provider, insurer, coverage, policyHolder, practitioner, motherPatient } = data;

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
      practitioner || { name: 'Default Practitioner', specialty_code: claim.practice_code || '22.00' }, // Dental
      bundleResourceIds.practitioner
    );
    
    // Build Encounter resource (required for oral claims)
    const encounterResource = this.buildOralClaimEncounter(claim, patient, provider, bundleResourceIds);
    
    // Build Claim resource
    const claimResource = this.buildOralClaimResource(claim, patient, provider, insurer, coverage, practitioner, bundleResourceIds);
    const messageHeader = this.buildClaimMessageHeader(provider, insurer, claimResource.fullUrl);

    // Oral bundle: INCLUDES Encounter resource (unlike Vision)
    const entries = [
      messageHeader,
      claimResource,
      encounterResource,
      coverageResource,
      practitionerResource,
      providerResource,
      insurerResource,
      newbornPatientResource, // Newborn patient
      ...(motherPatientResource ? [motherPatientResource] : []) // Mother patient if present
    ].filter(Boolean);

    // NOTE: Attachments should NOT be added as separate Binary resources
    // They are already included in supportingInfo as valueAttachment (embedded data)
    // Adding Binary resources causes GE-00013 error (invalid meta structure)
    // Following NPHIES examples: attachments are embedded in supportingInfo only

    return {
      resourceType: 'Bundle',
      id: this.generateId(),
      meta: { profile: ['http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/bundle|1.0.0'] },
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
    const senderNphiesId = provider.nphies_id || NPHIES_CONFIG.DEFAULT_PROVIDER_ID;
    const destinationNphiesId = insurer.nphies_id || 'INS-FHIR';

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
   * Build FHIR Claim resource for Oral Claim
   * Per NPHIES examples: Claim-173094.json and Claim-293094.json
   */
  buildOralClaimResource(claim, patient, provider, insurer, coverage, practitioner, bundleResourceIds) {
    const claimId = bundleResourceIds.claim;
    const providerIdentifierSystem = provider.identifier_system || 
      `http://${(provider.provider_name || 'provider').toLowerCase().replace(/\s+/g, '')}.com.sa/identifiers`;

    // Build extensions per NPHIES validation requirements
    // Note: AccountingPeriod may be required by NPHIES validation even if not shown in examples
    const extensions = [];

    // 1. AccountingPeriod extension (required per NPHIES validation IC-01620)
    // BV-01010: Day must be defaulted to "01" (e.g., "2025-12-01" not "2025-12-08")
    const serviceDate = new Date(claim.service_date || claim.request_date || new Date());
    const accountingPeriodDate = `${serviceDate.getFullYear()}-${String(serviceDate.getMonth() + 1).padStart(2, '0')}-01`;
    extensions.push({
      url: 'http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-accountingPeriod',
      valueDate: accountingPeriodDate
    });
    
    // 2. Encounter extension (required for oral claims)
    extensions.push({
      url: 'http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-encounter',
      valueReference: {
        reference: `Encounter/${bundleResourceIds.encounter}`
      }
    });

    // 3. Prior Auth Response extension (if claim has pre_auth_ref - per Claim-173094)
    if (claim.pre_auth_ref) {
      extensions.push({
        url: 'http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-priorauthresponse',
        valueReference: {
          identifier: {
            system: claim.pre_auth_ref_system || `http://${insurer.nphies_id || 'insurer'}.com.sa/identifiers/claimresponse`,
            value: claim.pre_auth_ref
          }
        }
      });
    }
    
    // 4. Episode extension (required)
    const episodeId = claim.episode_identifier || `${provider.nphies_id || 'SDC'}_EpisodeID_${claim.claim_number || Date.now()}`;
    extensions.push({
      url: 'http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-episode',
      valueIdentifier: { 
        system: `${providerIdentifierSystem}/episode`, 
        value: episodeId 
      }
    });

    // 5. Newborn extension - for newborn patient claims
    // Reference: https://portal.nphies.sa/ig/StructureDefinition-extension-newborn.html
    if (claim.is_newborn) {
      extensions.push({
        url: 'http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-newborn',
        valueBoolean: true
      });
    }

    const claimResource = {
      resourceType: 'Claim',
      id: claimId,
      meta: { profile: [this.getClaimProfileUrl()] },
      extension: extensions,
      identifier: [{ 
        system: `${providerIdentifierSystem}/claim`, 
        value: claim.claim_number || `req_${Date.now()}` 
      }],
      status: 'active',
      type: { 
        coding: [{ 
          system: 'http://terminology.hl7.org/CodeSystem/claim-type', 
          code: 'oral' 
        }] 
      },
      subType: { 
        coding: [{ 
          system: 'http://nphies.sa/terminology/CodeSystem/claim-subtype', 
          code: 'op'  // Oral claims are always outpatient
        }] 
      },
      use: 'claim',  // Changed from 'preauthorization'
      patient: { reference: `Patient/${bundleResourceIds.patient}` },
      created: this.formatDateTimeWithTimezone(claim.request_date || new Date()),
      insurer: { reference: `Organization/${bundleResourceIds.insurer}` },
      provider: { reference: `Organization/${bundleResourceIds.provider}` },
      priority: { 
        coding: [{ 
          system: 'http://terminology.hl7.org/CodeSystem/processpriority', 
          code: claim.priority || 'normal' 
        }] 
      },
      payee: { 
        type: { 
          coding: [{ 
            system: 'http://terminology.hl7.org/CodeSystem/payeetype', 
            code: 'provider' 
          }] 
        } 
      }
    };

    // CareTeam
    const pract = practitioner || claim.practitioner || {};
    const practiceCode = claim.practice_code || pract.practice_code || pract.specialty_code || '22.00'; // Dental
    claimResource.careTeam = [{
      sequence: 1,
      provider: { reference: `Practitioner/${bundleResourceIds.practitioner}` },
      role: { 
        coding: [{ 
          system: 'http://terminology.hl7.org/CodeSystem/claimcareteamrole', 
          code: 'primary' 
        }] 
      },
      qualification: { 
        coding: [{ 
          system: 'http://nphies.sa/terminology/CodeSystem/practice-codes', 
          code: practiceCode 
        }] 
      }
    }];

    // SupportingInfo - chief-complaint is REQUIRED for oral claims
    let supportingInfoSequences = [];
    let supportingInfoList = [...(claim.supporting_info || [])];
    
    // Add birth-weight supportingInfo for newborn patients
    // Reference: https://portal.nphies.sa/ig/StructureDefinition-extension-newborn.html
    // Per NPHIES Test Case 8: Newborn claim should include birth-weight
    // BV-00509: birth-weight valueQuantity SHALL use 'kg' code from UCUM
    if (claim.is_newborn && claim.birth_weight) {
      const hasBirthWeight = supportingInfoList.some(info => {
        const category = (info.category || '').toLowerCase();
        return category === 'birth-weight';
      });
      if (!hasBirthWeight) {
        // Convert grams to kilograms for NPHIES (BV-00509 requires kg)
        const weightInKg = parseFloat(claim.birth_weight) / 1000;
        supportingInfoList.push({
          category: 'birth-weight',
          value_quantity: weightInKg,
          value_quantity_unit: 'kg'
        });
      }
    }
    
    // Ensure chief-complaint exists
    if (!supportingInfoList.some(info => (info.category || '').toLowerCase() === 'chief-complaint')) {
      const clinicalInfo = claim.clinical_info || {};
      
      if (clinicalInfo.chief_complaint_text) {
        // Free text format per Claim-293094 example
        supportingInfoList.unshift({
          category: 'chief-complaint',
          code_text: clinicalInfo.chief_complaint_text
        });
      } else {
        // SNOMED code format per Claim-173094 example
        supportingInfoList.unshift({
          category: 'chief-complaint',
          code: clinicalInfo.chief_complaint_code || '27355003',
          code_display: clinicalInfo.chief_complaint_display || 'Toothache',
          code_system: 'http://snomed.info/sct'
        });
      }
    }
    
    if (supportingInfoList.length > 0) {
      claimResource.supportingInfo = supportingInfoList.map((info, idx) => {
        const seq = idx + 1;
        supportingInfoSequences.push(seq);
        return this.buildOralSupportingInfo({ ...info, sequence: seq });
      });
    }

    // Diagnosis - NO onAdmission for oral claims
    if (claim.diagnoses?.length > 0) {
      claimResource.diagnosis = claim.diagnoses.map((diag, idx) => ({
        sequence: diag.sequence || idx + 1,
        diagnosisCodeableConcept: { 
          coding: [{ 
            system: 'http://hl7.org/fhir/sid/icd-10-am', 
            code: diag.diagnosis_code, 
            display: diag.diagnosis_display 
          }] 
        },
        type: [{ 
          coding: [{ 
            system: 'http://nphies.sa/terminology/CodeSystem/diagnosis-type', 
            code: diag.diagnosis_type || 'principal' 
          }] 
        }]
        // NO onAdmission for oral claims
      }));
    }

    // Insurance
    claimResource.insurance = [{ 
      sequence: 1, 
      focal: true, 
      coverage: { reference: `Coverage/${bundleResourceIds.coverage}` } 
    }];

    // Items with oral-specific fields
    const claimServicedDate = claim.service_date || claim.request_date || new Date();
    if (claim.items?.length > 0) {
      claimResource.item = claim.items.map((item, idx) => 
        this.buildOralClaimItem(item, idx + 1, claimServicedDate, providerIdentifierSystem, claim, supportingInfoSequences)
      );
    }

    // Total - BV-00059: Must equal sum of item net values
    let totalAmount = 0;
    if (claim.items?.length > 0) {
      totalAmount = claim.items.reduce((sum, item) => {
        const quantity = parseFloat(item.quantity || 1);
        const unitPrice = parseFloat(item.unit_price || 0);
        const factor = parseFloat(item.factor || 1);
        const tax = parseFloat(item.tax || 0);
        return sum + (quantity * unitPrice * factor) + tax;
      }, 0);
    } else if (claim.total_amount) {
      totalAmount = parseFloat(claim.total_amount);
    }
    claimResource.total = { 
      value: totalAmount, 
      currency: claim.currency || 'SAR' 
    };

    return { 
      fullUrl: `http://provider.com/Claim/${claimId}`, 
      resource: claimResource 
    };
  }

  /**
   * Build SupportingInfo for Oral Claims
   * Per NPHIES examples: chief-complaint can use code.text OR code.coding
   * BV-00531: chief-complaint REQUIRES the code element
   */
  buildOralSupportingInfo(info) {
    const supportingInfo = {
      sequence: info.sequence,
      category: {
        coding: [{
          system: 'http://nphies.sa/terminology/CodeSystem/claim-information-category',
          code: info.category
        }]
      }
    };

    const category = (info.category || '').toLowerCase();

    // chief-complaint can use either code.text (free text) or code.coding (SNOMED)
    // BV-00531: The code element is REQUIRED for chief-complaint
    if (category === 'chief-complaint') {
      // Check for SNOMED code format first
      if (info.code && info.code_system) {
        // SNOMED coded complaint (per Claim-173094)
        supportingInfo.code = {
          coding: [{
            system: info.code_system,
            code: info.code,
            display: info.code_display
          }]
        };
      } else {
        // Free text complaint (per Claim-293094)
        // Check multiple sources: code_text, value_string, code_display, code
        const freeText = info.code_text || 
                         info.value_string || 
                         info.code_display || 
                         info.code ||
                         'Dental complaint';
        supportingInfo.code = {
          text: freeText
        };
      }
    } else {
      // Other categories use the standard buildSupportingInfo from BaseMapper
      return this.buildSupportingInfo(info);
    }

    return supportingInfo;
  }

  /**
   * Build claim item for Oral Claims
   * Per NPHIES examples: package, tax, patient-share, patientInvoice extensions
   * Plus bodySite for tooth number and subSite for tooth surfaces
   */
  buildOralClaimItem(item, sequence, servicedDate, providerIdentifierSystem, claim, supportingInfoSequences = []) {
    const quantity = parseFloat(item.quantity || 1);
    const unitPrice = parseFloat(item.unit_price || 0);
    const factor = parseFloat(item.factor || 1);
    const tax = parseFloat(item.tax || 0);
    const calculatedNet = (quantity * unitPrice * factor) + tax;

    // Oral claim item extensions per NPHIES examples
    // Order: package, tax, patient-share, patientInvoice
    const itemExtensions = [
      // Package extension (required for oral)
      {
        url: 'http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-package',
        valueBoolean: item.is_package || false
      },
      // Tax extension
      { 
        url: 'http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-tax', 
        valueMoney: { 
          value: tax, 
          currency: item.currency || claim?.currency || 'SAR' 
        } 
      },
      // Patient share extension
      { 
        url: 'http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-patient-share', 
        valueMoney: { 
          value: parseFloat(item.patient_share || 0), 
          currency: item.currency || claim?.currency || 'SAR' 
        } 
      },
      // PatientInvoice extension (required)
      {
        url: 'http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-patientInvoice',
        valueIdentifier: { 
          system: `${providerIdentifierSystem}/patientInvoice`, 
          value: item.patient_invoice || `Invc-${this.formatDate(new Date()).replace(/-/g, '')}/${item.product_or_service_code || 'Proc'}`
        }
      }
    ];

    const claimItem = {
      extension: itemExtensions,
      sequence,
      careTeamSequence: [1],
      diagnosisSequence: item.diagnosis_sequences || [1],
      productOrService: {
        coding: [{
          system: item.product_or_service_system || 'http://nphies.sa/terminology/CodeSystem/oral-health-op',
          code: item.product_or_service_code,
          display: item.product_or_service_display
        }]
      },
      servicedDate: this.formatDate(item.serviced_date || servicedDate),
      quantity: { value: quantity },
      unitPrice: { value: unitPrice, currency: item.currency || claim?.currency || 'SAR' },
      net: { value: calculatedNet, currency: item.currency || claim?.currency || 'SAR' }
    };

    // Add factor if not 1
    if (factor !== 1) {
      claimItem.factor = factor;
    }

    // Add detail array for package items (BV-00036: required when package=true)
    if (item.is_package === true && item.details && Array.isArray(item.details) && item.details.length > 0) {
      claimItem.detail = item.details.map((detail, idx) => {
        const detailQuantity = parseFloat(detail.quantity || 1);
        const detailUnitPrice = parseFloat(detail.unit_price || 0);
        const detailFactor = parseFloat(detail.factor || 1);
        const detailNet = (detailQuantity * detailUnitPrice * detailFactor);
        const detailServicedDate = detail.serviced_date || servicedDate;

        return {
          sequence: detail.sequence || (idx + 1),
          productOrService: {
            coding: [{
              system: detail.product_or_service_system || item.product_or_service_system || 'http://nphies.sa/terminology/CodeSystem/oral-health-op',
              code: detail.product_or_service_code,
              display: detail.product_or_service_display
            }]
          },
          servicedDate: this.formatDate(detailServicedDate),
          quantity: { value: detailQuantity },
          unitPrice: { 
            value: detailUnitPrice, 
            currency: detail.currency || item.currency || claim?.currency || 'SAR' 
          },
          net: { 
            value: detailNet, 
            currency: detail.currency || item.currency || claim?.currency || 'SAR' 
          }
        };
      });
    }

    // Add bodySite for tooth number (FDI oral region)
    if (item.tooth_number) {
      claimItem.bodySite = {
        coding: [{
          system: 'http://nphies.sa/terminology/CodeSystem/fdi-oral-region',
          code: item.tooth_number,
          display: item.tooth_display || this.getFdiToothDisplay(item.tooth_number)
        }]
      };

      // Add subSite for tooth surfaces if provided
      if (item.tooth_surface) {
        const surfaces = item.tooth_surface.split(',').map(s => s.trim());
        claimItem.subSite = surfaces.map(surface => ({
          coding: [{
            system: 'http://nphies.sa/terminology/CodeSystem/fdi-tooth-surface',
            code: surface,
            display: this.getToothSurfaceDisplay(surface)
          }]
        }));
      }
    }

    return claimItem;
  }

  /**
   * Build Encounter resource for Oral Claim
   * Per NPHIES examples: AMB only with serviceEventType extension
   */
  buildOralClaimEncounter(claim, patient, provider, bundleResourceIds) {
    const encounterId = bundleResourceIds.encounter;
    const patientId = bundleResourceIds.patient;
    const providerId = bundleResourceIds.provider;
    
    const providerIdentifierSystem = provider.identifier_system || 
      `http://${(provider.provider_name || 'provider').toLowerCase().replace(/\s+/g, '')}.com.sa/identifiers`;

    const encounterIdentifier = claim.encounter_identifier || 
                                `AB${String(Math.floor(Math.random() * 10000)).padStart(4, '0')}`;

    const encounter = {
      resourceType: 'Encounter',
      id: encounterId,
      meta: {
        profile: ['http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/encounter|1.0.0']
      },
      // serviceEventType extension is REQUIRED for oral claims
      extension: [
        {
          url: 'http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-serviceEventType',
          valueCodeableConcept: {
            coding: [
              {
                system: 'http://nphies.sa/terminology/CodeSystem/service-event-type',
                code: claim.service_event_type || 'ICSE',
                display: claim.service_event_type === 'SCSE' 
                  ? 'Subsequent client service event' 
                  : 'Initial client service event'
              }
            ]
          }
        }
      ],
      identifier: [
        {
          system: `${providerIdentifierSystem}/encounter`,
          value: encounterIdentifier
        }
      ],
      status: 'finished',  // Claim = service delivered, so encounter is finished
      class: {
        system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
        code: 'AMB',
        display: 'ambulatory'
      },
      serviceType: {
        coding: [{
          system: 'http://nphies.sa/terminology/CodeSystem/service-type',
          code: 'dental-care',
          display: 'Dental Care'
        }]
      },
      priority: {
        coding: [{
          system: 'http://terminology.hl7.org/CodeSystem/v3-ActPriority',
          code: 'EL',
          display: 'elective'
        }]
      },
      subject: { reference: `Patient/${patientId}` },
      period: {
        start: this.formatDateTimeWithTimezone(claim.encounter_start || claim.service_date || new Date())
        // No end date for AMB dental encounters per NPHIES examples
      },
      serviceProvider: { reference: `Organization/${providerId}` }
    };

    return {
      fullUrl: `http://provider.com/Encounter/${encounterId}`,
      resource: encounter
    };
  }

  /**
   * Parse Claim Response Bundle
   */
  parseClaimResponse(responseBundle) {
    // Reuse the PA response parser - structure is the same
    return this.parsePriorAuthResponse(responseBundle);
  }
}

export default OralClaimMapper;
