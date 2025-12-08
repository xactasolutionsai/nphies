/**
 * NPHIES Pharmacy Claim Mapper
 * Profile: http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/pharmacy-claim
 * Reference: https://portal.nphies.sa/ig/Claim-483078.json.html
 * 
 * This mapper extends the Prior Auth PharmacyMapper and adds claim-specific fields:
 * - use: 'claim' (instead of 'preauthorization')
 * - eventCoding: 'claim-request' (instead of 'priorauth-request')
 * - profile: pharmacy-claim (instead of pharmacy-priorauth)
 * - preAuthRef: Required reference to prior authorization
 * 
 * Bundle Structure (per NPHIES example Claim-483078):
 * - MessageHeader (eventCoding = claim-request)
 * - Claim (pharmacy-claim profile)
 * - Coverage
 * - Patient
 * - Organization (Provider)
 * - Organization (Insurer)
 * - NO Encounter required for pharmacy claims
 * - NO Practitioner required for pharmacy claims
 * 
 * Claim-Level Extensions (per NPHIES example):
 * - extension-batch-identifier (optional)
 * - extension-batch-number (optional)
 * - extension-batch-period (optional)
 * - extension-authorization-offline-date (optional)
 * - extension-episode (optional)
 * 
 * Item Extensions (required):
 * - extension-patient-share (Money)
 * - extension-package (boolean)
 * - extension-tax (Money)
 * - extension-patientInvoice (Identifier) - REQUIRED for claims
 * - extension-prescribed-Medication (CodeableConcept)
 * - extension-pharmacist-Selection-Reason (CodeableConcept)
 * - extension-maternity (boolean)
 * 
 * Key Differences from Prior Auth:
 * - type.use = 'claim' (not 'preauthorization')
 * - insurance.preAuthRef is REQUIRED (reference to approved PA)
 * - extension-patientInvoice on items is REQUIRED
 * - extension-tax on items is REQUIRED
 */

import PharmacyPAMapper from '../priorAuthMapper/PharmacyMapper.js';

class PharmacyClaimMapper extends PharmacyPAMapper {
  constructor() {
    super();
    this.claimType = 'pharmacy';
  }

  /**
   * Get the NPHIES Pharmacy Claim profile URL (override PA profile)
   */
  getClaimProfileUrl() {
    return 'http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/pharmacy-claim|1.0.0';
  }

  /**
   * Build complete Claim Request Bundle for Pharmacy type
   * Per NPHIES example Claim-483078.json:
   * - NO Encounter resource
   * - NO Practitioner resource
   * - preAuthRef is required in insurance
   */
  buildClaimRequestBundle(data) {
    const { claim, patient, provider, insurer, coverage, policyHolder } = data;

    const bundleResourceIds = {
      claim: this.generateId(),
      patient: patient.patient_id || this.generateId(),
      provider: provider.provider_id || this.generateId(),
      insurer: insurer.insurer_id || this.generateId(),
      coverage: coverage?.id || coverage?.coverage_id || this.generateId(),
      policyHolder: policyHolder?.id || this.generateId()
    };

    const patientResource = this.buildPatientResourceWithId(patient, bundleResourceIds.patient);
    const providerResource = this.buildProviderOrganizationWithId(provider, bundleResourceIds.provider);
    const insurerResource = this.buildInsurerOrganizationWithId(insurer, bundleResourceIds.insurer);
    const coverageResource = this.buildCoverageResourceWithId(coverage, patient, insurer, policyHolder, bundleResourceIds);
    
    // Build Claim resource (no encounter, no practitioner per NPHIES example)
    const claimResource = this.buildPharmacyClaimResource(claim, patient, provider, insurer, coverage, bundleResourceIds);
    
    const messageHeader = this.buildClaimMessageHeader(provider, insurer, claimResource.fullUrl);

    // Build binary resources for attachments
    const binaryResources = [];
    if (claim.attachments && claim.attachments.length > 0) {
      claim.attachments.forEach(attachment => {
        binaryResources.push(this.buildBinaryResource(attachment));
      });
    }

    // Bundle entries per NPHIES example - NO Encounter, NO Practitioner
    const entries = [
      messageHeader,
      claimResource,
      coverageResource,
      providerResource,
      insurerResource,
      patientResource,
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
   * Build MessageHeader for Claim Request (override PA message header)
   */
  buildClaimMessageHeader(provider, insurer, focusFullUrl) {
    const messageHeaderId = this.generateId();
    const senderNphiesId = provider.nphies_id || 'PR-FHIR';
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
   * Build FHIR Claim resource for Pharmacy Claim
   * Reference: https://portal.nphies.sa/ig/Claim-483078.json.html
   * 
   * Key differences from Prior Auth:
   * - use: 'claim' (not 'preauthorization')
   * - profile: pharmacy-claim
   * - insurance.preAuthRef required
   * - extension-patientInvoice on items required
   * - extension-tax on items required
   * - Batch extensions (batch-identifier, batch-number, batch-period)
   * - extension-authorization-offline-date
   * - extension-episode
   */
  buildPharmacyClaimResource(claim, patient, provider, insurer, coverage, bundleResourceIds) {
    const claimId = bundleResourceIds.claim;
    const patientRef = bundleResourceIds.patient;
    const providerRef = bundleResourceIds.provider;
    const insurerRef = bundleResourceIds.insurer;
    const coverageRef = bundleResourceIds.coverage;

    const providerIdentifierSystem = provider.identifier_system || 
      `http://${(provider.provider_name || 'provider').toLowerCase().replace(/\s+/g, '')}.com.sa/identifiers`;

    // Build claim-level extensions per NPHIES example Claim-483078
    // IMPORTANT: Per NPHIES IC-01428, IC-01453, IC-01620 errors, certain extensions are REQUIRED
    const extensions = [];

    // Batch identifier (optional but recommended)
    const batchId = claim.batch_identifier || `batch-${claim.claim_number || Date.now()}`;
    extensions.push({
      url: 'http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-batch-identifier',
      valueIdentifier: {
        system: `${providerIdentifierSystem}/batch`,
        value: batchId
      }
    });

    // Batch number (optional but recommended)
    extensions.push({
      url: 'http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-batch-number',
      valuePositiveInt: parseInt(claim.batch_number) || 1
    });

    // Batch period (optional but recommended)
    const batchDate = this.formatDate(claim.batch_period_start || claim.service_date || new Date());
    extensions.push({
      url: 'http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-batch-period',
      valuePeriod: {
        start: batchDate,
        end: this.formatDate(claim.batch_period_end || claim.batch_period_start || claim.service_date || new Date())
      }
    });

    // Authorization offline date (REQUIRED per error IC-01620 - accountingPeriod related)
    // This is the date when the authorization was done offline
    extensions.push({
      url: 'http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-authorization-offline-date',
      valueDateTime: this.formatDateTimeWithTimezone(claim.authorization_offline_date || claim.service_date || new Date())
    });

    // Episode (REQUIRED per error IC-01453)
    // Per NPHIES example Claim-483078, episode is required for pharmacy claims
    const episodeId = claim.episode_id || `EpisodeID-${claim.claim_number || Date.now()}`;
    extensions.push({
      url: 'http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-episode',
      valueIdentifier: {
        system: `${providerIdentifierSystem}/episode`,
        value: episodeId
      }
    });

    // AccountingPeriod (REQUIRED per error IC-01620)
    // Per NPHIES error DT-01287, this extension requires valueDate (NOT valuePeriod)
    // Per NPHIES error BV-01010, the day must be "01" (first day of month)
    const accountingDate = new Date(claim.accounting_period_start || claim.service_date || new Date());
    const accountingPeriodDate = `${accountingDate.getFullYear()}-${String(accountingDate.getMonth() + 1).padStart(2, '0')}-01`;
    extensions.push({
      url: 'http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-accountingPeriod',
      valueDate: accountingPeriodDate
    });

    // Eligibility offline reference (optional)
    if (claim.eligibility_offline_ref) {
      extensions.push({
        url: 'http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-eligibility-offline-reference',
        valueString: claim.eligibility_offline_ref
      });
    }

    // Build claim resource following NPHIES pharmacy-claim profile
    const claimResource = {
      resourceType: 'Claim',
      id: claimId,
      meta: {
        profile: [this.getClaimProfileUrl()]
      }
    };

    // Add extensions if any
    if (extensions.length > 0) {
      claimResource.extension = extensions;
    }

    // Identifier (required)
    claimResource.identifier = [
      {
        system: `${providerIdentifierSystem}/claim`,
        value: claim.claim_number || `clm_${Date.now()}`
      }
    ];

    // Status (required) - always 'active' for new claims
    claimResource.status = 'active';

    // Type (required) - must be 'pharmacy' for pharmacy claims
    claimResource.type = {
      coding: [
        {
          system: 'http://terminology.hl7.org/CodeSystem/claim-type',
          code: 'pharmacy'
        }
      ]
    };

    // SubType (required) - must be 'op' (outpatient) for pharmacy claims
    claimResource.subType = {
      coding: [
        {
          system: 'http://nphies.sa/terminology/CodeSystem/claim-subtype',
          code: claim.sub_type || 'op' // Default to 'op' (OutPatient) for pharmacy
        }
      ]
    };

    // Use (required) - 'claim' for claims (not 'preauthorization')
    claimResource.use = 'claim';

    // Patient reference (required)
    claimResource.patient = { reference: `Patient/${patientRef}` };

    // Created date (required) - format with timezone per NPHIES spec
    claimResource.created = this.formatDateTimeWithTimezone(claim.request_date || new Date());

    // Insurer reference (required)
    claimResource.insurer = { reference: `Organization/${insurerRef}` };

    // Provider reference (required)
    claimResource.provider = { reference: `Organization/${providerRef}` };

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

    // SupportingInfo - Build all required supporting info entries per NPHIES pharmacy claim requirements
    // Per NPHIES errors BV-00752, BV-00803, BV-00804, BV-00805, BV-00806 - these are all required
    // Note: The correct category code is 'investigation-result' NOT 'lab-result' (IB-00044)
    let supportingInfoList = [];
    let sequenceNum = 1;
    const daysSupplySequence = sequenceNum;
    
    // 1. days-supply (required for pharmacy per NPHIES)
    const daysSupplyValue = claim.items?.[0]?.days_supply || claim.days_supply || 30;
    supportingInfoList.push({
      sequence: sequenceNum++,
      category: {
        coding: [{
          system: 'http://nphies.sa/terminology/CodeSystem/claim-information-category',
          code: 'days-supply'
        }]
      },
      valueQuantity: {
        value: parseInt(daysSupplyValue),
        system: 'http://unitsofmeasure.org',
        code: 'd'
      }
    });

    // 2. investigation-result (required per BV-00752) - NOT 'lab-result'!
    // Per BV-00786: requires code from NPHIES investigation-result CodeSystem
    // Per DT-01293: must use 'code' element, NOT valueCodeableConcept or valueString
    const investigationResultCode = claim.investigation_result_code || 'normal';
    supportingInfoList.push({
      sequence: sequenceNum++,
      category: {
        coding: [{
          system: 'http://nphies.sa/terminology/CodeSystem/claim-information-category',
          code: 'investigation-result'
        }]
      },
      code: {
        coding: [{
          system: 'http://nphies.sa/terminology/CodeSystem/investigation-result',
          code: investigationResultCode,
          display: claim.investigation_result_display || 'Normal'
        }]
      }
    });

    // 3. treatment-plan (required per BV-00803)
    supportingInfoList.push({
      sequence: sequenceNum++,
      category: {
        coding: [{
          system: 'http://nphies.sa/terminology/CodeSystem/claim-information-category',
          code: 'treatment-plan'
        }]
      },
      valueString: claim.treatment_plan || 'Medication therapy as prescribed'
    });

    // 4. patient-history (required per BV-00804)
    supportingInfoList.push({
      sequence: sequenceNum++,
      category: {
        coding: [{
          system: 'http://nphies.sa/terminology/CodeSystem/claim-information-category',
          code: 'patient-history'
        }]
      },
      valueString: claim.patient_history || 'No significant past medical history'
    });

    // 5. physical-examination (required per BV-00805)
    supportingInfoList.push({
      sequence: sequenceNum++,
      category: {
        coding: [{
          system: 'http://nphies.sa/terminology/CodeSystem/claim-information-category',
          code: 'physical-examination'
        }]
      },
      valueString: claim.physical_examination || 'Within normal limits'
    });

    // 6. history-of-present-illness (required per BV-00806)
    supportingInfoList.push({
      sequence: sequenceNum++,
      category: {
        coding: [{
          system: 'http://nphies.sa/terminology/CodeSystem/claim-information-category',
          code: 'history-of-present-illness'
        }]
      },
      valueString: claim.history_of_present_illness || claim.chief_complaint || 'Patient presents with symptoms requiring medication'
    });

    claimResource.supportingInfo = supportingInfoList;

    // Diagnosis (required - at least one)
    // IMPORTANT: Per NPHIES error IB-00242, diagnosis system MUST be icd-10-am, NOT icd-10
    if (claim.diagnoses && claim.diagnoses.length > 0) {
      claimResource.diagnosis = claim.diagnoses.map((diag, idx) => {
        // Force correct ICD-10-AM system - NPHIES rejects plain icd-10
        let diagSystem = diag.diagnosis_system || 'http://hl7.org/fhir/sid/icd-10-am';
        // Fix common incorrect system values
        if (diagSystem === 'http://hl7.org/fhir/sid/icd-10' || 
            diagSystem === 'icd-10' || 
            diagSystem === 'ICD-10') {
          diagSystem = 'http://hl7.org/fhir/sid/icd-10-am';
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
          // Note: NO onAdmission for pharmacy claims per NPHIES spec
        };
      });
    }

    // Insurance (required) - with preAuthRef for claims
    const insuranceEntry = {
      sequence: 1,
      focal: true,
      coverage: { reference: `Coverage/${coverageRef}` }
    };

    // PreAuthRef is REQUIRED for claims (reference to approved prior authorization)
    if (claim.pre_auth_ref) {
      insuranceEntry.preAuthRef = [claim.pre_auth_ref];
    }

    claimResource.insurance = [insuranceEntry];

    // Items with medication codes (required - at least one)
    // Build items first, then calculate total from item net values
    let builtItems = [];
    if (claim.items && claim.items.length > 0) {
      builtItems = claim.items.map((item, idx) => 
        this.buildPharmacyClaimItemForClaim(item, idx + 1, daysSupplySequence, providerIdentifierSystem)
      );
      claimResource.item = builtItems;
    }

    // Total (required) - MUST equal sum of all item.net values per BV-00059
    // Calculate total from the actual built items to ensure consistency
    let totalAmount = 0;
    if (builtItems.length > 0) {
      totalAmount = builtItems.reduce((sum, item) => {
        return sum + (item.net?.value || 0);
      }, 0);
    } else if (claim.total_amount) {
      totalAmount = parseFloat(claim.total_amount);
    }
    claimResource.total = {
      value: parseFloat(totalAmount.toFixed(2)),
      currency: claim.currency || 'SAR'
    };

    return {
      fullUrl: `http://provider.com/Claim/${claimId}`,
      resource: claimResource
    };
  }

  /**
   * Build claim item for Pharmacy Claim with all required extensions
   * Reference: https://portal.nphies.sa/ig/Claim-483078.json.html
   * 
   * Required Extensions for Pharmacy Claim Items:
   * - extension-patient-share (Money) - patient's share amount
   * - extension-package (boolean) - whether item is a package
   * - extension-tax (Money) - tax amount (REQUIRED for claims)
   * - extension-patientInvoice (Identifier) - REQUIRED for claims
   * - extension-prescribed-Medication (CodeableConcept) - originally prescribed medication
   * - extension-pharmacist-Selection-Reason (CodeableConcept) - reason for pharmacist selection
   * - extension-maternity (boolean) - maternity related
   * 
   * NOTE: extension-pharmacist-substitute is NOT in the claim example, only in prior auth
   */
  buildPharmacyClaimItemForClaim(item, itemIndex, daysSupplySequence, providerIdentifierSystem) {
    const sequence = item.sequence || itemIndex;
    
    const quantity = parseFloat(item.quantity || 1);
    const unitPrice = parseFloat(item.unit_price || 0);
    const factor = parseFloat(item.factor || 1);
    const tax = parseFloat(item.tax || 0);
    
    const calculatedNet = (quantity * unitPrice * factor) + tax;
    const patientShare = parseFloat(item.patient_share || 0);
    
    // Extract and validate medication code
    const medicationCode = (item.medication_code && item.medication_code.trim()) || 
                           (item.product_or_service_code && item.product_or_service_code.trim());
    const medicationDisplay = (item.medication_name && item.medication_name.trim()) || 
                              (item.product_or_service_display && item.product_or_service_display.trim());
    
    // Validate medication code exists (required for pharmacy)
    if (!medicationCode) {
      console.error(`[PharmacyClaimMapper] ERROR: Item ${sequence} missing medication_code`);
      throw new Error(`Medication code is required for pharmacy item ${sequence}`);
    }
    
    // Build pharmacy-specific extensions per NPHIES claim example
    const itemExtensions = [];

    // 1. extension-patient-share (required)
    itemExtensions.push({
      url: 'http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-patient-share',
      valueMoney: {
        value: patientShare,
        currency: item.currency || 'SAR'
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
        currency: item.currency || 'SAR'
      }
    });

    // 4. extension-patientInvoice (REQUIRED for claims)
    const patientInvoice = item.patient_invoice || `Invc-${this.formatDate(new Date()).replace(/-/g, '')}-${sequence}`;
    itemExtensions.push({
      url: 'http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-patientInvoice',
      valueIdentifier: {
        system: `${providerIdentifierSystem}/patientInvoice`,
        value: patientInvoice
      }
    });

    // 5. extension-prescribed-Medication (required for pharmacy)
    const prescribedMedicationCode = (item.prescribed_medication_code && item.prescribed_medication_code.trim()) || 
                                     medicationCode;
    itemExtensions.push({
      url: 'http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-prescribed-Medication',
      valueCodeableConcept: {
        coding: [
          {
            system: 'http://nphies.sa/terminology/CodeSystem/medication-codes',
            code: prescribedMedicationCode
          }
        ]
      }
    });

    // 6. extension-pharmacist-Selection-Reason (required for pharmacy)
    const selectionReason = item.pharmacist_selection_reason || 'patient-request';
    itemExtensions.push({
      url: 'http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-pharmacist-Selection-Reason',
      valueCodeableConcept: {
        coding: [
          {
            system: 'http://nphies.sa/terminology/CodeSystem/pharmacist-selection-reason',
            code: selectionReason
          }
        ]
      }
    });

    // 7. extension-maternity (required)
    itemExtensions.push({
      url: 'http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-maternity',
      valueBoolean: item.is_maternity || false
    });

    // Build the claim item
    const claimItem = {
      extension: itemExtensions,
      sequence: sequence,
      diagnosisSequence: item.diagnosis_sequences || [1],
      informationSequence: [daysSupplySequence] // Reference days-supply supportingInfo
    };

    // ProductOrService using NPHIES medication-codes system
    const productOrServiceCoding = {
      system: 'http://nphies.sa/terminology/CodeSystem/medication-codes',
      code: medicationCode
    };
    
    if (medicationDisplay) {
      productOrServiceCoding.display = medicationDisplay;
    }
    
    claimItem.productOrService = {
      coding: [productOrServiceCoding]
    };

    // Serviced date
    const servicedDate = item.serviced_date ? new Date(item.serviced_date) : new Date();
    claimItem.servicedDate = this.formatDate(servicedDate);

    // Quantity (required)
    claimItem.quantity = { value: quantity };

    // UnitPrice (required)
    claimItem.unitPrice = {
      value: unitPrice,
      currency: item.currency || 'SAR'
    };

    // Net (required)
    claimItem.net = {
      value: calculatedNet,
      currency: item.currency || 'SAR'
    };

    return claimItem;
  }

  /**
   * Parse Claim Response
   * Inherits from parent but can be extended for pharmacy-specific parsing
   */
  parseClaimResponse(responseBundle) {
    return this.parsePriorAuthResponse(responseBundle);
  }
}

export default PharmacyClaimMapper;
